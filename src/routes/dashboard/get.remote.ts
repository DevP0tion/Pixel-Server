import { query } from '$app/server';
import { server } from 'src/hooks.server';

export const _getUnityServers = query("unchecked", () => {
  return server.getUnityServerList();
});