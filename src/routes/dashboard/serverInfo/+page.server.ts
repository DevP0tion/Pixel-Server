import type { ZoneInfo } from '$lib/socket';
import { randomUUID } from 'crypto';
import { server } from 'src/hooks.server';

export async function load ({ url }) {
	const serverId = url.searchParams.get('serverId') || '';

	// 서버 사이드에서 직접 Socket.IO로 Unity에 zones:list 요청

	try {
		const data: ZoneInfo[] = (await server.unity(serverId).fetch('zones:list', {}))[0].data
		console.log('Fetched zones from Unity:', data);

		return { zones: data };
	} catch (error) {
		console.error('Failed to fetch zones from Unity:', error);
		return { zones: [], error: error instanceof Error ? error.message : 'Unknown error' };
	}
};
