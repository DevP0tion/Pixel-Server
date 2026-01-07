import { contextBridge, ipcRenderer } from 'electron';

// Electron API를 웹 페이지에 안전하게 노출
contextBridge.exposeInMainWorld('electron', {
	// 필요한 API를 여기에 추가
	platform: process.platform,
	versions: {
		node: process.versions.node,
		chrome: process.versions.chrome,
		electron: process.versions.electron
	}
});
