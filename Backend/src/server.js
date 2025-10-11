// Backend/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";               // ← trocado (antes: 'bcrypt')
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authMiddleware } from "./auth.js";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// validações
const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
const categorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["REVENUE", "COST", "EXPENSE"]),
});
const transactionSchema = z.object({
  categoryId: z.number().int(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  description: z.string().min(1),
  amount: z.number(),
});

// health (útil p/ Render)
app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), env: "production" });
});

// auth
app.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados inválidos" });
  const { name, email, password } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "email já cadastrado" });

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, password: hash } });
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(user.id), expiresIn: "7d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados inválidos" });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "credenciais inválidas" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "credenciais inválidas" });

  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(user.id), expiresIn: "7d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// categories
app.get("/categories", authMiddleware, async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  res.json(categories);
});
app.post("/categories", authMiddleware, async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados inválidos" });
  const cat = await prisma.category.create({ data: parsed.data });
  res.status(201).json(cat);
});
app.put("/categories/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados inválidos" });
  try {
    const cat = await prisma.category.update({ where: { id }, data: parsed.data });
    res.json(cat);
  } catch {
    res.status(404).json({ error: "categoria não encontrada" });
  }
});
app.delete("/categories/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "categoria não encontrada" });
  }
});

// transactions
app.get("/transactions", authMiddleware, async (req, res) => {
  const list = await prisma.transaction.findMany({
    where: { userId: req.user.id },
    include: { category: true },
    orderBy: { date: "desc" },
  });
  res.json(list);
});
app.post("/transactions", authMiddleware, async (req, res) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados inválidos" });

  const { categoryId, date, description, amount } = parsed.data;
  const dt = date.length === 10 ? new Date(date + "T00:00:00") : new Date(date);

  const trx = await prisma.transaction.create({
    data: { userId: req.user.id, categoryId, date: dt, description, amount },
  });
  res.status(201).json(trx);
});
app.put("/transactions/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = transactionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados inválidos" });

  const data = { ...parsed.data };
  if (data.date) data.date = data.date.length === 10 ? new Date(data.date + "T00:00:00") : new Date(data.date);

  try {
    const trx = await prisma.transaction.update({ where: { id }, data });
    if (trx.userId !== req.user.id) return res.status(403).json({ error: "forbidden" }); // Por quê: não expor dados de outro usuário
    res.json(trx);
  } catch {
    res.status(404).json({ error: "lançamento não encontrado" });
  }
});
app.delete("/transactions/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const trx = await prisma.transaction.delete({ where: { id } });
    if (trx.userId !== req.user.id) return res.status(403).json({ error: "forbidden" });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "lançamento não encontrado" });
  }
});

// DRE
app.get("/dre", authMiddleware, async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date("1970-01-01");
  const to = req.query.to ? new Date(String(req.query.to)) : new Date("2999-12-31");

  const rows = await prisma.transaction.findMany({
    where: { userId: req.user.id, date: { gte: from, lte: to } },
    include: { category: true },
  });

  const sum = { REVENUE: 0, COST: 0, EXPENSE: 0 };
  for (const r of rows) sum[r.category.type] += Number(r.amount);

  const receitaBruta = sum.REVENUE;
  const custo = sum.COST;
  const lucroBruto = receitaBruta - custo;
  const despesa = sum.EXPENSE;
  const resultado = lucroBruto - despesa;

  res.json({
    period: { from, to },
    totals: { receitaBruta, custo, lucroBruto, despesa, resultado },
    breakdown: sum,
  });
});

app.get("/", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ API on http://localhost:${PORT}`);
});
