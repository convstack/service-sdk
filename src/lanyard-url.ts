export function lanyardBaseUrl(explicit?: string): string {
	const url = explicit || process.env.LANYARD_URL || "http://localhost:3000";
	return url.replace(/\/+$/, "");
}
