import { Server, type Socket } from 'socket.io';
import EventEmitter from 'eventemitter3';

// Command type definition
interface Command {
	type: string;
	data?: unknown;
}

// Command response type
interface CommandResponse {
	success: boolean;
	type: string;
	data?: unknown;
	error?: string;
}

// Connected client interface
interface ConnectedClient {
	socket: Socket;
	id: string;
	authenticated: boolean;
	connectedAt: Date;
}

/**
 * Event emitter for custom command handlers.
 *
 * Custom handlers can be registered to handle commands not built-in to the server.
 * The event name is the command type, and the callback receives (socket, data).
 *
 * Custom handlers should emit their own response via socket.emit('command:response', response).
 *
 * @example
 * ```typescript
 * import { commandEmitter } from './hooks.server';
 *
 * commandEmitter.on('myCustomCommand', (socket, data) => {
 *   // Handle the command
 *   socket.emit('command:response', {
 *     success: true,
 *     type: 'myCustomCommand',
 *     data: { result: 'processed' }
 *   });
 * });
 * ```
 */
export const commandEmitter = new EventEmitter();

// Map to store connected clients
const connectedClients: Map<string, ConnectedClient> = new Map();

// CORS origins configuration - defaults to allowing all origins for development
// In production, set ALLOWED_ORIGINS environment variable to comma-separated list of origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
	: '*';

// Create Socket.IO server instance
export const io = new Server({
	cors: {
		origin: allowedOrigins,
		methods: ['GET', 'POST']
	}
});

// Command handler function
function handleCommand(socket: Socket, command: Command): CommandResponse {
	const { type, data } = command;

	switch (type) {
		case 'ping':
			return {
				success: true,
				type: 'pong',
				data: { timestamp: Date.now() }
			};

		case 'echo':
			return {
				success: true,
				type: 'echo',
				data
			};

		case 'status':
			return {
				success: true,
				type: 'status',
				data: {
					connectedClients: connectedClients.size,
					serverTime: new Date().toISOString()
				}
			};

		case 'authenticate': {
			const client = connectedClients.get(socket.id);
			if (client) {
				client.authenticated = true;
				return {
					success: true,
					type: 'authenticated',
					data: { clientId: socket.id }
				};
			}
			return {
				success: false,
				type: 'authenticate',
				error: 'Client not found'
			};
		}

		case 'broadcast':
			if (data && typeof data === 'object' && 'message' in data) {
				socket.broadcast.emit('broadcast', {
					from: socket.id,
					message: (data as { message: string }).message
				});
				return {
					success: true,
					type: 'broadcast',
					data: { delivered: true }
				};
			}
			return {
				success: false,
				type: 'broadcast',
				error: 'Invalid message format'
			};

		default: {
			// Check if there are custom handlers registered for this command type
			const hasCustomHandler = commandEmitter.listenerCount(type) > 0;
			if (hasCustomHandler) {
				// Emit event for custom command handlers
				// Custom handlers are responsible for sending their own response via socket.emit
				commandEmitter.emit(type, socket, data);
				return {
					success: true,
					type: type,
					data: { handledByCustomHandler: true }
				};
			}
			return {
				success: false,
				type: 'unknown',
				error: `Unknown command type: ${type}`
			};
		}
	}
}

// Socket.IO connection handler
io.on('connection', (socket: Socket) => {
	console.log(`Game server connected: ${socket.id}`);

	// Register client
	connectedClients.set(socket.id, {
		socket,
		id: socket.id,
		authenticated: false,
		connectedAt: new Date()
	});

	// Handle command event
	socket.on('command', (command: Command) => {
		try {
			const response = handleCommand(socket, command);
			socket.emit('command:response', response);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			socket.emit('command:response', {
				success: false,
				type: command?.type || 'unknown',
				error: errorMessage
			});
		}
	});

	// Handle disconnect
	socket.on('disconnect', () => {
		console.log(`Game server disconnected: ${socket.id}`);
		connectedClients.delete(socket.id);
	});

	// Send welcome message
	socket.emit('welcome', {
		message: 'Connected to Pixel Server',
		clientId: socket.id,
		serverTime: new Date().toISOString()
	});
});

console.log('Starting game server on port 7777');

io.listen(7777);
