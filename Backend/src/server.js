// Backend/src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from './auth.js';

import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url)); // why: ESM não tem __dirname

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT) || 3001; // why: Render injeta PORT

app.use(cors());
app.use(express.json());

// ---------- HEALTH ----------
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), env: 'production' });
});

// ---------- SERVIR FRONT wwroot ----------
const publicDir = path.resolve(__dirname, '../wwroot'); // why: caminho estável em produção
app.use(express.static(publicDir));
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ---------- SUAS ROTAS EXISTENTES (exemplos de montagem) ----------
// import authRoutes from './routes/auth.js';
// app.use('/auth', authRoutes);
// app.use('/categories', authMiddleware, categoriesRoutes);
// app.use('/transactions', authMiddleware, transactionsRoutes);
// app.use('/dre', authMiddleware, dreRoutes);

// ---------- START ----------
const server = app.listen(PORT, () => {
  console.log(`[server] listening on :${PORT}`);
});

// ---------- SHUTDOWN GRACIOSO ----------
const shutdown = (sig) => () => {
  console.log(`[server] ${sig} received, closing...`);
  server.close(async () => {
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  });
};
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, shutdown(s)));
