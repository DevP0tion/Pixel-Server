import type { ZoneInfo } from '$lib/socket';
import { server } from 'src/hooks.server';

const ZONES_TIMEOUT_MS = 5000;

export async function load ({ url }) {
	const serverId = url.searchParams.get('serverId') || '';

	// 서버 사이드에서 직접 Socket.IO로 Unity에 zones:list 요청

	const fetchZones = () =>
		new Promise<ZoneInfo[]>((resolve, reject) => {
			const { io, unityServers } = server;

			const cleanup = () => {
				io.off('zones:list', onZones);
				io.off('connect_error', onError);
				clearTimeout(timer);
			};

			const timer = setTimeout(() => {
				cleanup();
				reject(new Error('Timeout waiting for zones response'));
			}, ZONES_TIMEOUT_MS);

			const onError = (err: Error) => {
				cleanup();
				reject(err);
			};

			const onZones = (payload: { zones?: ZoneInfo[]; code?: number; message?: string }) => {
				cleanup();
				if (payload.code && payload.code !== 100 && !payload.zones) {
					reject(new Error(payload.message || 'Zones 정보를 가져올 수 없습니다.'));
					return;
				}
				resolve(payload.zones ?? []);
			};

			io.once('connect_error', onError);
			io.once('zones:list', onZones);

			// Unity 서버로 zones:list 요청 전송 (targetUnityId는 쿼리의 serverId 사용)
			unityServers.get(serverId)?.emit('unity:command');
		});

	try {
		const zones = await fetchZones();
		console.log('Fetched zones from Unity:', zones);

		return { zones };
	} catch (error) {
		console.error('Failed to fetch zones from Unity:', error);
		return { zones: [], error: error instanceof Error ? error.message : 'Unknown error' };
	}
};
