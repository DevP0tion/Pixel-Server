import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { spawn } from 'node:child_process';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ReturnType<typeof spawn> | null = null;

function startServer() {
	const isDev = process.env.NODE_ENV === 'development';

	if (!isDev) {
		// 프로덕션에서 SvelteKit 서버 시작
		const serverPath = path.join(__dirname, '../build/index.js');
		serverProcess = spawn('node', [serverPath], {
			env: { ...process.env, PORT: '3000' }
		});

		serverProcess.stdout?.on('data', (data) => {
			console.log(`Server: ${data}`);
		});

		serverProcess.stderr?.on('data', (data) => {
			console.error(`Server Error: ${data}`);
		});
	}
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
		mainWindow.loadURL('http://localhost:5173');
		mainWindow.webContents.openDevTools();
	} else {
		// 프로덕션에서는 로컬 서버로 연결
		setTimeout(() => {
			mainWindow?.loadURL('http://localhost:3000');
		}, 10000); // 서버 시작 대기
	}

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

app.whenReady().then(() => {
	startServer();
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (serverProcess) {
		serverProcess.kill();
	}
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('quit', () => {
	if (serverProcess) {
		serverProcess.kill();
	}
});
