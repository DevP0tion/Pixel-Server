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
- 서버 정보
name : Pixel Server
version : 1.0.0
uptime : ${process.uptime()} seconds
memory:
	rss : ${Math.round(rss / 1024 / 1024)} MB
	heapTotal : ${Math.round(heapTotal / 1024 / 1024)} MB
	heapUsed : ${Math.round(heapUsed / 1024 / 1024)} MB
	availableMemory : ${Math.round(process.availableMemory() / 1024 / 1024)} MB
	node : ${process.version}

- 연결된 클라이언트 수
	unityServers: ${server.unityServers.size}
	webClients: ${server.webClients.size}
	serverTime: ${new Date().toISOString()}
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
