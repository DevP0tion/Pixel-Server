import { ServerManager } from '$lib/server/socketIO.js';
import { initializeFirebase } from '$lib/server/firebase.js';
import { initializeDatabase } from '$lib/server/database/mysql';
import { building } from '$app/environment';
import { PUBLIC_SOCKET_PORT } from '$env/static/public';

// MySQL 데이터베이스 초기화
export const dbPool = initializeDatabase();

// Firebase 초기화
export const { app: firebaseApp, auth: firebaseAuth } = initializeFirebase();

// Socket.IO 서버 시작
// 빌드 중에는 서버를 시작하지 않음
if (!building) {
	ServerManager.getInstance().start(Number(PUBLIC_SOCKET_PORT));
}
