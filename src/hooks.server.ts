import { Server } from 'socket.io';

export const io = new Server();

io.on('connection', (socket) => {
  console.log('game server connected');
});

console.log("Starting game server on port 7777");

io.listen(7777);