import { command } from '$app/server';
import { server } from 'src/hooks.server';
import { logger, type LogType } from '$lib/server/logger';

export const _printStatus = command('unchecked', async () => {
	if (!server) {
		logger.log('svelte', '서버가 초기화되지 않았습니다.');
	}

	const { rss, heapTotal, heapUsed } = process.memoryUsage();

	logger.log(
		'svelte',
		`
		\n- 서버 정보
		\nname : Pixel Server
		\nversion : 1.0.0
		\nuptime : ${process.uptime()} seconds
		\nmemory:
		\n  rss : ${Math.round(rss / 1024 / 1024)} MB
		\n  heapTotal : ${Math.round(heapTotal / 1024 / 1024)} MB
		\n  heapUsed : ${Math.round(heapUsed / 1024 / 1024)} MB
		\n	availableMemory : ${Math.round(process.availableMemory() / 1024 / 1024)} MB
		\nnode : ${process.version}

		\n- 연결된 클라이언트 수
		\nunityServers: ${server.unityServers.size}
		\nwebClients: ${server.webClients.size}
		\nserverTime: ${new Date().toISOString()}
	`
	);

	return;
});

export const _ping = command('unchecked', async () => {
	const timestamp = Date.now();
	logger.log('svelte', `ping received at ${new Date(timestamp).toISOString()} / ${timestamp}`);

	return;
});

export const _log = command<{ type: LogType; message: string }, void>(
	'unchecked',
	async ({ message, type }) => {
		logger.log(type, message);
	}
);
