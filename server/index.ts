import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './database/connection';
import chatRoutes from './routes/chat';
import { setupSocketHandlers } from './socket/handlers';

dotenv.config();

const app = express();
const server = createServer(app);

// 🚀 Redis 클라이언트 설정 (Socket.IO 스케일링용)
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.warn('REDIS_URL environment variable is not set. Redis adapter will not be used.');
}

const pubClient = createClient({
  url: REDIS_URL,
  socket: {
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100
  }
});
const subClient = pubClient.duplicate();

// Socket.IO 서버 설정 with Redis Adapter
const allowedSocketOrigins = [
  process.env.FRONTEND_URL,
  'https://buyve.vercel.app',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
  process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null
].filter(Boolean) as string[];

const io = new Server(server, {
  cors: {
    origin: allowedSocketOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  // 🎯 성능 최적화 설정
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true
});

// Redis Adapter 적용
async function setupRedisAdapter() {
  if (!REDIS_URL) {
    return;
  }

  try {
    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
}

// 미들웨어 설정 - CORS 보안 강화
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://buyve.vercel.app',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
  process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // origin이 없는 경우 (Postman, curl 등) 허용 (선택적)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// API 라우트
app.use('/api/chat', chatRoutes);

// 상태 확인 엔드포인트
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    process: process.pid,
    connections: io.engine.clientsCount
  });
});

// Socket.IO 핸들러 설정
setupSocketHandlers(io);

// 서버 시작
const PORT = process.env.PORT || 3001;

async function startServer() {
  await setupRedisAdapter();
  
  server.listen(PORT, () => {
    // 서버 시작 로그 제거됨
  });
}

startServer();

// 우아한 종료
process.on('SIGTERM', async () => {
  
  try {
    await pubClient.quit();
    await subClient.quit();
    await db.close();
    server.close();
  } catch {
    // 종료 중 오류 처리 로그 제거됨
  }
  
  process.exit(0);
});

export { io }; 