import { Server, Socket } from 'socket.io';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {

    // 채팅방 참가
    socket.on('join_room', (roomId: string) => {
      socket.join(`room:${roomId}`);
      
      // 참가 알림 (선택적)
      socket.to(`room:${roomId}`).emit('user_joined', {
        socketId: socket.id,
        roomId,
        timestamp: new Date()
      });
    });

    // 채팅방 나가기
    socket.on('leave_room', (roomId: string) => {
      socket.leave(`room:${roomId}`);
      
      // 나가기 알림 (선택적)
      socket.to(`room:${roomId}`).emit('user_left', {
        socketId: socket.id,
        roomId,
        timestamp: new Date()
      });
    });

    // 타이핑 상태 전송
    socket.on('typing_start', (data: { roomId: string; userAddress: string }) => {
      socket.to(`room:${data.roomId}`).emit('user_typing', {
        socketId: socket.id,
        userAddress: data.userAddress,
        roomId: data.roomId,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data: { roomId: string; userAddress: string }) => {
      socket.to(`room:${data.roomId}`).emit('user_typing', {
        socketId: socket.id,
        userAddress: data.userAddress,
        roomId: data.roomId,
        isTyping: false
      });
    });

    // 연결 해제
    socket.on('disconnect', () => {
      // 연결 해제 로그 제거됨
    });

    // 에러 핸들링
    socket.on('error', () => {
      // 에러 로그 제거됨
    });
  });

  // 전체 연결 상태 로깅 제거됨
} 