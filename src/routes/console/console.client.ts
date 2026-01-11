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
	[
		'status',
		new SvelteCommand(
			'status',
			async () => await _printStatus(undefined),
			'서버 상태를 표시합니다.'
		)
	],
	['ping', new SvelteCommand('ping', async () => await _ping(undefined), 'pong 응답을 반환합니다.')]
]);

function helpHandler(): CommandResponse {
	const lines = ['사용 가능한 Svelte 서버 명령어:'];

	svelteCommandSet.forEach((cmd) => {
		lines.push(`- ${cmd.command}: ${cmd.description}`);
	});

	return {
		code: 100,
		message: lines.join('\n')
	};
}

function parseArgsRecord(args: string[]) {
	const record: Argument = {};
	for (const part of args) {
		if (!part) continue;
		const [key, value] = part.split('=');
		if (!key) continue;
		if (value === undefined) {
			record[key] = true;
			continue;
		}
		const numeric = Number(value);
		record[key] = Number.isNaN(numeric) ? value : numeric;
	}
	return record;
}

export async function handleSvelteCommand(input: string) {
	const trimmed = input.trim();

	if (!trimmed) {
		_log('명령어가 입력되지 않았습니다.');
		return;
	}

	const args = trimmed.split(/\s+/);
	const command = args[0];
	const cmd = svelteCommandSet.get(command);

	if (!cmd) {
		_log(`알 수 없는 명령어: ${command}`);
		return;
	}

	return cmd.handler(args.slice(1));
}

export function handlerUnityCommand(input: string) {}
