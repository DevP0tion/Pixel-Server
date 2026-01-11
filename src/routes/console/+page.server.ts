import { logger } from '$lib/server/logger';

export async function load() {
	return { logs: logger.logs };
}
