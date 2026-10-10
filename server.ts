import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { db } from './backend/db/datastore.js';
import { createApiRouter } from './backend/routes/api.js';

async function startServer() {
  await db.connectMongo();

  const app = express();
  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Serve /src/assets statically so food images always work in both dev and production
  app.use('/src/assets', express.static(path.resolve(process.cwd(), 'src', 'assets')));

  // Serve Web App Manifest & Service Worker directly so mobile app installation always works
  app.get('/manifest.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.json({
      id: '/',
      name: 'Ember & Oak — Restaurant & Food Ordering App',
      short_name: 'EmberOak',
      description: 'Order wood-fired pizzas, craft burgers, and track live delivery.',
      theme_color: '#0c0a09',
      background_color: '#0c0a09',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    });
  });

  app.get('/sw.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
      self.addEventListener('install', () => self.skipWaiting());
      self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
      self.addEventListener('fetch', () => {});
    `);
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);

  io.on('connection', (socket) => {
    socket.on('join:role', (role: string) => {
      socket.join(`role:${role}`);
    });
  });

  app.use('/api', createApiRouter(io));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Ember & Oak Full-Stack Server & Socket.IO listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});