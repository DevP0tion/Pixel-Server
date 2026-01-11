import { logger } from '$lib/server/logger';

export async function load() {
	const refinedLogs = logger.logs.filter((log) => log !== undefined);

	return { logs: refinedLogs };
}
