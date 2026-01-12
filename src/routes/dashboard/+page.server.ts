import { ServerManager } from '$lib/server/socketIO';

export async function load() {
	const unityServers = ServerManager.getInstance().getUnityServerList();

	return { unityServers };
}
