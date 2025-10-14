// Backend/src/server.js  (apenas o topo e as rotas de estático/raiz)
import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authMiddleware } from "./auth.js";

// >> ADICIONE ESTAS 3 LINHAS
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ---------- HEALTH (continua igual) ----------
app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), env: "production" });
});

// ---------- SERVIR FRONT wwroot ----------
const publicDir = path.resolve(__dirname, "../wwroot"); // <- pasta do seu index.html
app.use(express.static(publicDir));
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// (RESTO DO ARQUIVO: suas rotas /auth, /categories, /transactions, /dre permanecem iguais)
