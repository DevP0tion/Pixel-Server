import type { AuthPacket, MovePacket, BulletPacket } from './types.js';

/**
 * AuthPacket 타입 검증
 */
export function isAuthPacket(args: unknown): args is AuthPacket {
	return (
		typeof args === 'object' &&
		args !== null &&
		'username' in args &&
		'password' in args &&
		typeof (args as AuthPacket).username === 'string' &&
		typeof (args as AuthPacket).password === 'string'
	);
}

/**
 * MovePacket 타입 검증
 */
export function isMovePacket(args: unknown): args is MovePacket {
	if (typeof args !== 'object' || args === null) return false;
	const packet = args as MovePacket;
	return (
		typeof packet.direction === 'object' &&
		packet.direction !== null &&
		typeof packet.direction.x === 'number' &&
		typeof packet.direction.y === 'number' &&
		typeof packet.canceled === 'boolean'
	);
}

/**
 * BulletPacket 타입 검증
 */
export function isBulletPacket(args: unknown): args is BulletPacket {
	if (typeof args !== 'object' || args === null) return false;
	const packet = args as BulletPacket;
	return (
		typeof packet.typeName === 'string' &&
		typeof packet.teamName === 'string' &&
		typeof packet.damage === 'number' &&
		typeof packet.startPos === 'object' &&
		packet.startPos !== null &&
		typeof packet.startPos.x === 'number' &&
		typeof packet.startPos.y === 'number' &&
		typeof packet.startPos.z === 'number' &&
		typeof packet.targetPos === 'object' &&
		packet.targetPos !== null &&
		typeof packet.targetPos.x === 'number' &&
		typeof packet.targetPos.y === 'number' &&
		typeof packet.targetPos.z === 'number'
	);
}
