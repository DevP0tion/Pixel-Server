import { produce, type Start, type Stop } from 'sveltekit-sse';
import { logger, type LogEntry } from '$lib/server/logger';

export async function POST({ request }) {
	let emitter: (entry: LogEntry) => void;

	const start: Start = ({ emit }) => {
		emitter = (entry: LogEntry) => {
			emit('new-log', JSON.stringify(entry));
		};

		logger.on('log', emitter);
	};

	return produce(start, {
		stop: () => emitter && (logger.off('log', emitter) as any)
	});
}
