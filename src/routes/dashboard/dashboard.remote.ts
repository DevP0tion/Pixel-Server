import { command, query } from '$app/server';
import { ServerManager } from '$lib/server/socketIO';

// Unity 서버 중지 명령
export const _stopUnityServer = command<
	{ unitySocketId: string },
	{ success: boolean; message: string }
>('unchecked', ({ unitySocketId }) => {
	const server = ServerManager.getInstance();

	if (!server) {
		return { success: false, message: '서버가 초기화되지 않았습니다.' };
	}

	const unitySocket = server.unityServers.get(unitySocketId);
	if (!unitySocket) {
		return { success: false, message: 'Unity 서버를 찾을 수 없습니다.' };
	}

	// Unity 서버에 중지 명령 전송
	unitySocket.emit('server:stop', {});
	return { success: true, message: 'Unity 서버 중지 명령을 전송했습니다.' };
});

// Unity 서버 별칭 변경 명령
export const _setUnityAlias = command<
	{ unitySocketId: string; alias: string },
	{ success: boolean; message: string }
>('unchecked', ({ unitySocketId, alias }) => {
	const server = ServerManager.getInstance();

	if (!server) {
		return { success: false, message: '서버가 초기화되지 않았습니다.' };
	}

	if (!server.unityServers.has(unitySocketId)) {
		return { success: false, message: 'Unity 서버를 찾을 수 없습니다.' };
	}

	const trimmedAlias = alias?.trim() || 'Game Server';
	server.unityServerAliases.set(unitySocketId, trimmedAlias);

	return { success: true, message: `별칭이 "${trimmedAlias}"(으)로 변경되었습니다.` };
});

export const _getUnityServers = query('unchecked', () => {
	return ServerManager.getInstance().getUnityServerList();
});
