import { logger } from '$lib/server/logger';

export const prerender = false;

export async function load() {
	const refinedLogs = logger.logs.filter((log) => log !== undefined);

	return { logs: refinedLogs };
}
