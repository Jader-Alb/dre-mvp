// Backend/prisma/seed.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Por que: rodar sem travar deploy. Usa findFirst para evitar depender de índice único.
async function upsertByName(model, data) {
  const existing = await prisma[model].findFirst({ where: { name: data.name } });
  if (!existing) return prisma[model].create({ data });
  // só atualiza se mudou algo
  const { id, ...rest } = existing;
  const needsUpdate = Object.keys(data).some(k => data[k] !== rest[k]);
  if (needsUpdate) return prisma[model].update({ where: { id }, data });
  return existing;
}

async function main() {
  const categories = [
    { name: 'Vendas',         type: 'REVENUE' },
    { name: 'Devoluções',     type: 'REVENUE' },
    { name: 'CMV/Despesa',    type: 'COST' },
    { name: 'Despesas Admin', type: 'EXPENSE' },
    { name: 'Outras Operac.', type: 'EXPENSE' },
  ];

  for (const c of categories) await upsertByName('category', c);

  // Usuário admin de exemplo (ajuste depois: hash de senha)
  const admin = await prisma.user.findFirst({ where: { email: 'admin@dre.local' } });
  if (!admin) {
    await prisma.user.create({
      data: { name: 'Admin', email: 'admin@dre.local', password: 'changeme' },
    });
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
