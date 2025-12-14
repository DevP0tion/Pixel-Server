// Types
export type {
	CommandData,
	CommandTarget,
	CommandResponse,
	AuthPacket,
	AuthResponseMessage,
	MovePacket,
	BulletPacket,
	ClientType,
	ConnectedClient,
	CommandHandler
} from './types.js';

// Command Handler
export { SocketCommandHandler } from './SocketCommandHandler.js';

// Commands
export { loadCommands } from './commands.js';

export const SocketRooms = {
	UnityServers: 'unity_servers',
	WebClients: 'web_clients'
}