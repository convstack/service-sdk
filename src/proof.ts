import {
	createRemoteJWKSet,
	customFetch,
	decodeProtectedHeader,
	errors,
	type JWTPayload,
	jwtVerify,
} from "jose";
import { z } from "zod";
import { lanyardFetch } from "./lanyard";
import { lanyardBaseUrl } from "./lanyard-url";

export interface RequestUser {
	id: string;
	name: string;
	email: string;
	permissions: string[];
	orgRoles: Array<{ orgId: string; name?: string; slug: string; role: string }>;
}

export interface ServiceCaller {
	slug: string;
	scope: string[];
}

export type Principal =
	| { kind: "user"; user: RequestUser }
	| { kind: "service"; caller: ServiceCaller };

export type ProofCheck =
	| { ok: true; principal: Principal }
	| { ok: false; status: 401 | 503; error: string };

const USER_PROOF = "convstack-user+jwt";
const SERVICE_PROOF = "convstack-service+jwt";
// jose passes network errors through, and wraps a bad answer from the key set
// URL in these; every other JOSEError means the proof itself is bad
const KEY_SET_UNAVAILABLE = new Set([
	"ERR_JOSE_GENERIC",
	"ERR_JWKS_TIMEOUT",
	"ERR_JWKS_INVALID",
]);
const SLUG_RETRY_MS = 10_000;
const REFUSAL_LOG_MS = 60_000;

const unauthorized: ProofCheck = {
	ok: false,
	status: 401,
	error: "Unauthorized",
};
const unavailable: ProofCheck = {
	ok: false,
	status: 503,
	error: "Service unavailable",
};

const userClaims = z.object({
	sub: z.string().min(1),
	name: z.string(),
	email: z.string(),
	perms: z.array(z.string()),
	orgs: z.array(
		z.object({
			orgId: z.string(),
			name: z.string(),
			slug: z.string(),
			role: z.string(),
		}),
	),
});

const serviceClaims = z.object({
	sub: z.string().startsWith("service:"),
	scope: z.array(z.string()),
});

interface KeySet {
	url: string;
	// the last answer's status, which jose's errors leave out
	status?: number;
	get: ReturnType<typeof createRemoteJWKSet>;
}

let keySet: KeySet | null = null;

function lanyardKeys(): KeySet {
	const url = `${lanyardBaseUrl()}/.well-known/jwks.json`;
	if (keySet?.url !== url) {
		// a short cooldown lets a proof from a freshly rotated key through quickly;
		// a 1-minute max age stops trusting a retired key a minute after lanyard
		// stops publishing it (jose's default would take 10)
		const set: KeySet = {
			url,
			get: createRemoteJWKSet(new URL(url), {
				cooldownDuration: 5_000,
				cacheMaxAge: 60_000,
				[customFetch]: async (input, init) => {
					set.status = undefined;
					const res = await fetch(input, init);
					set.status = res.status;
					return res;
				},
			}),
		};
		keySet = set;
	}
	return keySet;
}

let ownSlug: string | null = null;
let slugLookup: Promise<string | null> | null = null;
let slugRetryAt = 0;

async function lookUpSlug(): Promise<string | null> {
	try {
		const res = await lanyardFetch("/api/services/me");
		if (!res.ok) {
			throw new Error(`lanyard /api/services/me answered ${res.status}`);
		}
		const { slug } = (await res.json()) as { slug?: unknown };
		if (typeof slug !== "string" || !slug) {
			throw new Error("lanyard /api/services/me sent no slug");
		}
		ownSlug = slug;
		return slug;
	} catch (err) {
		slugRetryAt = Date.now() + SLUG_RETRY_MS;
		console.error(
			"[service-sdk] refusing requests until lanyard names this service:",
			err instanceof Error ? err.message : err,
		);
		return null;
	}
}

// the registration in lanyard is the only source of the slug proofs are made out to
async function serviceSlug(): Promise<string | null> {
	if (ownSlug) return ownSlug;
	if (Date.now() < slugRetryAt) return null;
	slugLookup ??= lookUpSlug().finally(() => {
		slugLookup = null;
	});
	return slugLookup;
}

const refusalLoggedAt = new Map<string, number>();

// a proof lanyard signed yet refused means clocks or configuration disagree,
// and every request repeats it; the proof and its claims stay out of the log
function logRefusal(
	claim: string,
	detail: string,
	what = "a proof lanyard signed",
) {
	const now = Date.now();
	const last = refusalLoggedAt.get(claim);
	if (last !== undefined && now - last < REFUSAL_LOG_MS) return;
	refusalLoggedAt.set(claim, now);
	console.error(`[service-sdk] refused ${what}: ${detail}`);
}

function refusedClaims(kind: "user" | "service", error: z.ZodError) {
	const paths = error.issues.map((issue) => issue.path.map(String).join("."));
	logRefusal(
		`${kind} claims`,
		`${kind} claims don't match at ${paths.join(", ")}`,
	);
	return unauthorized;
}

const checked = new WeakMap<Request, Promise<ProofCheck>>();

/**
 * Checks the proof lanyard signed for this request (`Authorization: Bearer`).
 * Fails closed: 401 for a missing or bad proof, 503 while lanyard can't be
 * asked for this service's slug or signing keys.
 */
export function checkProof(request: Request): Promise<ProofCheck> {
	// createHandler and every helper called with this request share one result
	let check = checked.get(request);
	if (!check) {
		check = verifyProof(request);
		checked.set(request, check);
	}
	return check;
}

async function verifyProof(request: Request): Promise<ProofCheck> {
	const authorization = request.headers.get("authorization");
	if (!authorization?.startsWith("Bearer ")) return unauthorized;
	const token = authorization.slice(7);

	let typ: string | undefined;
	try {
		typ = decodeProtectedHeader(token).typ;
	} catch {
		return unauthorized;
	}
	if (typ !== USER_PROOF && typ !== SERVICE_PROOF) return unauthorized;

	const audience = await serviceSlug();
	if (!audience) return unavailable;

	const keys = lanyardKeys();
	let payload: JWTPayload;
	try {
		({ payload } = await jwtVerify(token, keys.get, {
			issuer: "lanyard",
			audience,
			typ,
			algorithms: ["ES256"],
			clockTolerance: 30,
			// lanyard's proofs live 60 seconds, whatever a proof's exp says
			maxTokenAge: 60,
			requiredClaims: ["exp", "iat"],
		}));
	} catch (err) {
		// jose checks claims only once the signature holds
		if (
			err instanceof errors.JWTClaimValidationFailed ||
			err instanceof errors.JWTExpired
		) {
			let detail = `claim ${err.claim}, reason ${err.reason}`;
			if (err.claim === "aud") {
				detail += `; this service expects aud ${audience}`;
			}
			// an iat in the future; one too far in the past comes as JWTExpired
			if (
				err.claim === "iat" &&
				err.reason === "check_failed" &&
				err instanceof errors.JWTClaimValidationFailed
			) {
				detail += "; this host's clock may be behind lanyard's";
			}
			logRefusal(err.claim, detail);
			return unauthorized;
		}
		if (err instanceof errors.JOSEError && !KEY_SET_UNAVAILABLE.has(err.code)) {
			// a rotation gone wrong looks like this on every request; so does
			// anyone's made-up token, hence once a minute and no more
			if (
				err.code === "ERR_JWKS_NO_MATCHING_KEY" ||
				err.code === "ERR_JWKS_MULTIPLE_MATCHING_KEYS"
			) {
				logRefusal(
					err.code,
					"its signing key isn't in lanyard's key set exactly once",
					"a proof",
				);
			}
			return unauthorized;
		}
		const { origin, pathname } = new URL(keys.url);
		console.error(
			`[service-sdk] can't load lanyard's signing keys from ${origin}${pathname}${keys.status ? ` (status ${keys.status})` : ""}:`,
			err instanceof Error ? err.message : err,
		);
		return unavailable;
	}

	if (typ === USER_PROOF) {
		const claims = userClaims.safeParse(payload);
		if (!claims.success) return refusedClaims("user", claims.error);
		return {
			ok: true,
			principal: {
				kind: "user",
				user: {
					id: claims.data.sub,
					name: claims.data.name,
					email: claims.data.email,
					permissions: claims.data.perms,
					orgRoles: claims.data.orgs,
				},
			},
		};
	}
	const claims = serviceClaims.safeParse(payload);
	if (!claims.success) return refusedClaims("service", claims.error);
	return {
		ok: true,
		principal: {
			kind: "service",
			caller: {
				slug: claims.data.sub.slice("service:".length),
				scope: claims.data.scope,
			},
		},
	};
}
