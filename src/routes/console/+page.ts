import io from 'socket.io-client';

export async function load() {
	io('http://localhost:7777', { auth: {} });
}
