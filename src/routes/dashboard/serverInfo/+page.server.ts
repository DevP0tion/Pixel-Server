import { ServerManager } from '$lib/server/socketIO';

export const prerender = false;

type ZoneInfo = {
	id: number;
	playerCount: number;
	additionalInfo: string[];
};

export async function load({ url }) {
	const serverId = url.searchParams.get('serverId') || '';

	if (!serverId) {
		return { zones: [], error: '서버 ID가 없습니다.' };
	}

	try {
		const responses = await ServerManager.getInstance().unity(serverId).fetch('zones:list', {});
		const zones: ZoneInfo[] = JSON.parse(responses[0].data);

		return { zones };
	} catch (error) {
		console.error('Failed to fetch zones from Unity:', error);
		return { zones: [], error: error instanceof Error ? error.message : 'Unknown error' };
	}
}
