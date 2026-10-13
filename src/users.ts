/**
 * User name resolution via Lanyard's public user API.
 * Cached for 10 minutes per user ID.
 */

import { lanyardFetch } from "./lanyard";

const cache = new Map<string, { name: string; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000;

let warnedAt = 0;

// every name on a page fails the same way; one line a minute says why
function warnUnresolved(reason: string) {
	const now = Date.now();
	if (now - warnedAt < 60_000) return;
	warnedAt = now;
	console.warn(
		`[service-sdk] can't resolve user names from lanyard: ${reason}`,
	);
}

/**
 * Resolve a user ID to a display name via Lanyard.
 */
export async function resolveUserName(userId: string): Promise<string> {
	if (userId === "system") return "System";
	if (userId === "[deleted]") return "[Deleted]";

	const cached = cache.get(userId);
	if (cached && cached.expires > Date.now()) {
		return cached.name;
	}

	try {
		const response = await lanyardFetch(
			`/api/users/${encodeURIComponent(userId)}`,
		);

		if (!response.ok) {
			if (response.status !== 404) {
				warnUnresolved(`lanyard answered ${response.status}`);
			}
			return truncateId(userId);
		}

		const data = await response.json();
		const name = data.name || truncateId(userId);

		cache.set(userId, { name, expires: Date.now() + CACHE_TTL });
		return name;
	} catch (err) {
		warnUnresolved(err instanceof Error ? err.message : String(err));
		return truncateId(userId);
	}
}

/**
 * Resolve multiple user IDs to names, ten at a time.
 */
export async function resolveUserNames(
	userIds: string[],
): Promise<Map<string, string>> {
	const unique = [...new Set(userIds)];
	const names = new Map<string, string>();
	for (let i = 0; i < unique.length; i += 10) {
		const batch = unique.slice(i, i + 10);
		const resolved = await Promise.all(batch.map(resolveUserName));
		batch.forEach((id, n) => {
			names.set(id, resolved[n]);
		});
	}
	return names;
}

function truncateId(id: string): string {
	return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}
