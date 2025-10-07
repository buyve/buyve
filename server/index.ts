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

// Redis client setup (for Socket.IO scaling)
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

// Socket.IO server setup with Redis Adapter
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
  // Performance optimization settings
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true
});

// Apply Redis Adapter
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

// Middleware setup - enhanced CORS security
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://buyve.vercel.app',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
  process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow when no origin (Postman, curl, etc.) - optional
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

// API routes
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    process: process.pid,
    connections: io.engine.clientsCount
  });
});

// Socket.IO handler setup
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  await setupRedisAdapter();

  server.listen(PORT, () => {
    // Server start log removed
  });
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {

  try {
    await pubClient.quit();
    await subClient.quit();
    await db.close();
    server.close();
  } catch {
    // Error handling log during shutdown removed
  }

  process.exit(0);
});

export { io }; 