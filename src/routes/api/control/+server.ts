import { ServerManager } from '$lib/server/socketIO.js';
import { control_token } from '$env/static/private';

type CommonControlData = {
	token: string;
};

type ControlRequest = CommonControlData & (SendToUnityData | SendToWebConsoleData);

type SendToUnityData = {
	action: 'socket';
	target: 'unity';
	event: string;
	data?: string;
};

type SendToWebConsoleData = {
	action: 'socket';
	target: 'webconsole';
	event: string;
	data?: string;
};

// AI 제어용 API 엔드포인트

export async function POST({ request }) {
	const data: ControlRequest = await request.json();
	if (data.token !== control_token) {
		return new Response('Unauthorized', { status: 401 });
	}

	console.log('Received control API request:', data);

	switch (data.action) {
		case 'socket':
			switch (data.target) {
				case 'unity':
					return handleUnityCommand(data);
				case 'webconsole':
					return handleWebConsoleCommand(data);
			}
	}

	return new Response('Control API is under construction', { status: 501 });
}

function handleUnityCommand({ event, data }: SendToUnityData) {
	ServerManager.getInstance().unityServers.forEach((socket, _) => {
		// 여기서 socket.emit(...) 등을 사용하여 Unity 서버에 명령을 보낼 수 있습니다.

		socket.emit('unity:command', { cmd: event, data: data });
	});

	return new Response('Unity command sent', { status: 200 });
}

function handleWebConsoleCommand({ event, data }: SendToWebConsoleData) {
	ServerManager.getInstance().webClients.forEach((socket, _) => {
		// 여기서 socket.emit(...) 등을 사용하여 웹 콘솔에 명령을 보낼 수 있습니다.
		socket.emit(event, data);
	});

	return new Response('Web console command sent', { status: 200 });
}
