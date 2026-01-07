import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Server } from 'node:http';

const DEV_PORT = 5173;
const PROD_PORT = '3000';

let mainWindow: BrowserWindow | null = null;
// let serverModule: { server?: { server?: Server } } | null = null;
let server: Server | null = null;

async function startServer() {
	const isDev = process.env.NODE_ENV === 'development';

	if (!isDev) {
		const serverPath = path.join(__dirname, '../build/index.js');
		if (!process.env.PORT) {
			process.env.PORT = PROD_PORT;
		}

		try {
			const module = await import(pathToFileURL(serverPath).href);

			server = module.server.server;
		} catch (error) {
			console.error('Failed to start server:', error);
		}
	}
}

function stopServer() {
	const httpServer = server;
	if (httpServer) {
		httpServer.close();
	}
	server = null;
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			nodeIntegration: false,
			contextIsolation: true
		}
	});

	// 개발 환경에서는 Vite dev 서버로 연결
	if (process.env.NODE_ENV === 'development') {
		mainWindow.loadURL(`http://localhost:${DEV_PORT}`);
		mainWindow.webContents.openDevTools();
	} else {
		// 프로덕션에서는 로컬 서버로 연결
		setTimeout(() => {
			mainWindow?.loadURL(`http://localhost:${PROD_PORT}`);
		}, 10000); // 서버 시작 대기
	}

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

app.whenReady().then(async () => {
	await startServer();
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	stopServer();
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('quit', () => {
	stopServer();
});

app.on('quit', () => {
	if (server) {
		server.close();
	}
});
