import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const defaults = [
    { name: "Vendas", type: "REVENUE" },
    { name: "Serviços", type: "REVENUE" },
    { name: "CMV", type: "COST" },
    { name: "Folha", type: "EXPENSE" },
    { name: "Aluguel", type: "EXPENSE" },
    { name: "Marketing", type: "EXPENSE" }
  ];

  for (const c of defaults) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c
    });
  }
  console.log("✅ Seed ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
