import { startSocketServer } from '$lib/server/socketIO.js';
import { initializeFirebase } from '$lib/server/firebase.js';

export const { app: firebaseApp, auth: firebaseAuth } = initializeFirebase();

// Socket.IO 서버 시작
startSocketServer(7777);
