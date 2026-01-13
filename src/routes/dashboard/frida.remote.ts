import { command } from '$app/server';
import path from 'path';
import { ServerManager } from '$lib/server/socketIO';
import { building } from '$app/environment';

export const _createServer = command('unchecked', async () => {
	if (building) {
		throw new Error('Cannot create unity server during build time.');
	}

	const frida = await import('frida');
	const projectRoot = process.env.root as string;
	const sessionId = crypto.randomUUID();

	const pid = await frida.spawn(path.resolve(projectRoot, 'unity', 'Pixel Collector.exe'), {
		env: { FRIDA_SESSION_ID: sessionId }
	});

	const session = await frida.attach(pid);
	const script = await session.createScript("console.log('Hello from Frida script!');");
	await script.load();

	// Session 저장
	const serverManager = ServerManager.getInstance();
	serverManager.fridaSessions.set(sessionId, session);
	serverManager.fridaProcessIds.set(sessionId, pid);

	return { pid, sessionId };
});
