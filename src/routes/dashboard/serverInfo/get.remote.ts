import { command } from '$app/server';
import { error as kitError } from '@sveltejs/kit';
import type { ZoneInfo } from '$lib/socket';
import { server } from 'src/hooks.server';

export const _getServerZones = command('unchecked', async ({ serverId }: { serverId?: string }) => {
	if (!serverId) {
		throw kitError(400, 'serverId is required');
	}

	try {
		const responses = await server.unity(serverId).fetch('zones:list', {});
		const zones: ZoneInfo[] = JSON.parse(responses[0].data);

		return zones;
	} catch (err) {
		console.error('Failed to fetch zones from Unity:', err);
		throw kitError(500, 'Failed to fetch zones from Unity server');
	}
});
