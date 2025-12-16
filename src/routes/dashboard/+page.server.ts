import { server } from 'src/hooks.server';

export async function load() {
	const unityServers = server.getUnityServerList();

	return { unityServers };
}
