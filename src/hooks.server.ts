import { startSocketServer } from '$lib/server/socketIO.js';
import { initializeFirebase } from '$lib/server/firebase.js';
import { initializeDatabase } from '$lib/server/database/mysql';

// MySQL 데이터베이스 초기화
export const dbPool = initializeDatabase();

// Firebase 초기화
export const { app: firebaseApp, auth: firebaseAuth } = initializeFirebase();

// Socket.IO 서버 시작
startSocketServer(7777);
