import { Server, Socket } from 'socket.io';

// 🚀 연결 제한 설정
const MAX_CONNECTIONS = 1000; // 최대 동시 연결 수
const MAX_ROOMS_PER_USER = 20; // 사용자당 최대 방 개수
const CONNECTION_TIMEOUT = 60000; // 연결 타임아웃 (1분)

// 🎯 사용자별 방 목록 추적 (메모리 누수 방지)
const userRooms = new Map<string, Set<string>>();

export function setupSocketHandlers(io: Server) {
  // 🎯 연결 수 모니터링 (1분마다)
  setInterval(() => {
    const connectionCount = io.engine.clientsCount;
    const roomCount = userRooms.size;
  }, 60000);

  io.on('connection', (socket: Socket) => {
    // 🎯 1. 연결 수 제한 체크
    if (io.engine.clientsCount > MAX_CONNECTIONS) {
      socket.emit('error', {
        message: 'Server at capacity. Please try again later.',
        code: 'MAX_CONNECTIONS'
      });
      socket.disconnect(true);
      return;
    }

    // 🎯 2. 사용자 ID 추출 (인증 정보 또는 socket.id 사용)
    const userId = socket.handshake.auth?.userId || socket.id;

    // 🎯 3. 연결 타임아웃 설정 (비정상 연결 방지)
    socket.setTimeout(CONNECTION_TIMEOUT);

    // 채팅방 참가
    socket.on('join_room', (roomId: string) => {
      // 🎯 방 개수 제한 체크
      const rooms = userRooms.get(userId) || new Set<string>();

      if (rooms.size >= MAX_ROOMS_PER_USER) {
        socket.emit('error', {
          message: `Maximum ${MAX_ROOMS_PER_USER} rooms per user`,
          code: 'MAX_ROOMS'
        });
        return;
      }

      // 방 참가
      socket.join(`room:${roomId}`);
      rooms.add(roomId);
      userRooms.set(userId, rooms);

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

      // 🎯 사용자 방 목록에서 제거
      const rooms = userRooms.get(userId);
      if (rooms) {
        rooms.delete(roomId);
        if (rooms.size === 0) {
          userRooms.delete(userId);
        }
      }

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

    // 🎯 연결 해제 (자동 정리)
    socket.on('disconnect', (reason: string) => {
      // 🎯 모든 방에서 자동으로 나가기
      const rooms = userRooms.get(userId);
      if (rooms) {
        rooms.forEach(roomId => {
          socket.leave(`room:${roomId}`);
        });
        userRooms.delete(userId);
      }
    });

    // 🎯 에러 핸들링
    socket.on('error', (error: Error) => {
      console.error(`❌ [Socket Error] User ${userId.slice(0, 8)}:`, error.message);

      // 심각한 에러 시 연결 종료
      if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
        socket.disconnect(true);
      }
    });

    // 🎯 타임아웃 핸들링
    socket.on('timeout', () => {
      socket.disconnect(true);
    });
  });

  // 🎯 서버 종료 시 정리
  process.on('SIGTERM', () => {
    userRooms.clear();
    io.close(() => {
    });
  });
} 