import { _printStatus, _log, _ping } from './console.remote';

export type CommandResponse = {
	code: number;
	message: string;
	data?: any;
};

export type Argument = { [key: string]: string | number | boolean };

type CommandHandler = (args: string[]) => void;

class SvelteCommand {
	constructor(
		public command: string,
		public readonly handler: CommandHandler,
		public description = 'Svelte 서버 명령어입니다.'
	) {}
}

const svelteCommandSet = new Map<string, SvelteCommand>([
	['help', new SvelteCommand('help', helpHandler, '도움말을 표시합니다.')],
	['status', new SvelteCommand('status', _printStatus, '서버 상태를 표시합니다.')],
	['ping', new SvelteCommand('ping', _ping, 'pong 응답을 반환합니다.')]
]);

function helpHandler() {
	const lines = ['사용 가능한 Svelte 서버 명령어:'];

	svelteCommandSet.forEach((cmd) => {
		lines.push(`- ${cmd.command}: ${cmd.description}`);
	});

	_log({ type: 'svelte', message: lines.join('\n') });
}

export async function handleSvelteCommand(input: string) {
	_log({ type: 'input', message: input });

	if (input.length === 0) {
		_log({ type: 'svelte', message: '명령어가 입력되지 않았습니다.' });
		return;
	}

	const args = input.split(' ');
	const command = args[0];
	const cmd = svelteCommandSet.get(command);

	if (!cmd) {
		_log({ type: 'svelte', message: `알 수 없는 명령어: ${command}` });
		return;
	}

	return cmd.handler(args.slice(1));
}

export function handlerUnityCommand(input: string) {}
