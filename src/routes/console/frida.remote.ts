import { command, query } from '$app/server';
import { ServerManager } from '$lib/server/socketIO';
import { logger } from '$lib/server/logger';
import { building } from '$app/environment';

// 스크립트 주입
export const _injectScript = command<
	{ serverId: string; scriptCode: string },
	Promise<{ success: boolean; message: string }>
>('unchecked', async ({ serverId, scriptCode }) => {
	const server = ServerManager.getInstance();
	const session = server.fridaSessions.get(serverId);

	if (!session) {
		return { success: false, message: 'Frida session을 찾을 수 없습니다' };
	}

	try {
		const script = await session.createScript(scriptCode);
		await script.load();
		logger.log('unity-control', `스크립트가 ${serverId}에 주입되었습니다`);
		return { success: true, message: '스크립트 주입 성공' };
	} catch (error) {
		return { success: false, message: `스크립트 주입 실패: ${error}` };
	}
});

// 프로세스 종료
export const _killProcess = command<
	{ serverId: string },
	Promise<{ success: boolean; message: string }>
>('unchecked', async ({ serverId }) => {
	if (building) {
		throw new Error('Cannot kill unity server during build time.');
	}
	const frida = await import('frida');

	const server = ServerManager.getInstance();
	const session = server.fridaSessions.get(serverId);
	const pid = server.fridaProcessIds.get(serverId);

	if (!pid) {
		return { success: false, message: '프로세스를 찾을 수 없습니다' };
	}

	try {
		if (session) {
			await session.detach();
		}
		await frida.kill(pid);

		server.fridaSessions.delete(serverId);
		server.fridaProcessIds.delete(serverId);

		logger.log('unity-control', `프로세스 ${pid} 종료됨`);
		return { success: true, message: '프로세스 종료됨' };
	} catch (error) {
		return { success: false, message: `종료 실패: ${error}` };
	}
});

// 메모리 읽기
export const _readMemory = command<
	{ serverId: string; address: string; size: number },
	Promise<{ success: boolean; data?: string; message: string }>
>('unchecked', async ({ serverId, address, size }) => {
	const server = ServerManager.getInstance();
	const session = server.fridaSessions.get(serverId);

	if (!session) {
		return { success: false, message: 'Frida session을 찾을 수 없습니다' };
	}

	try {
		const script = await session.createScript(`
			const addr = ptr('${address}');
			const data = Memory.readByteArray(addr, ${size});
			send({ data: Array.from(new Uint8Array(data)) });
		`);

		let result: any = null;
		script.message.connect((message: any) => {
			if (message.type === 'send') {
				result = message.payload;
			}
		});

		await script.load();

		return {
			success: true,
			data: JSON.stringify(result),
			message: '메모리 읽기 성공'
		};
	} catch (error) {
		return { success: false, message: `메모리 읽기 실패: ${error}` };
	}
});

// 메모리 쓰기
export const _writeMemory = command<
	{ serverId: string; address: string; data: number[] },
	Promise<{ success: boolean; message: string }>
>('unchecked', async ({ serverId, address, data }) => {
	const server = ServerManager.getInstance();
	const session = server.fridaSessions.get(serverId);

	if (!session) {
		return { success: false, message: 'Frida session을 찾을 수 없습니다' };
	}

	try {
		const script = await session.createScript(`
			const addr = ptr('${address}');
			const data = [${data.join(',')}];
			Memory.writeByteArray(addr, data);
		`);
		await script.load();

		logger.log('unity-control', `메모리 쓰기: ${address}`);
		return { success: true, message: '메모리 쓰기 성공' };
	} catch (error) {
		return { success: false, message: `메모리 쓰기 실패: ${error}` };
	}
});

// Frida 서버 목록 가져오기
export const _getFridaServers = query('unchecked', () => {
	return ServerManager.getInstance().getFridaServerList();
});
