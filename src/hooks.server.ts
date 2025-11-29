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

// Event emitter for command handling
export const commandEmitter = new EventEmitter();

// Map to store connected clients
const connectedClients: Map<string, ConnectedClient> = new Map();

// Create Socket.IO server instance
export const io = new Server({
	cors: {
		origin: '*',
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

		default:
			// Emit event for custom command handlers
			commandEmitter.emit(type, socket, data);
			return {
				success: false,
				type: 'unknown',
				error: `Unknown command type: ${type}`
			};
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
