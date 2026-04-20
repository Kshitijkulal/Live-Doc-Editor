import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const exists = await prisma.document.findFirst();

  if (!exists) {
    await prisma.document.create({
      data: {
        content: "",
      }
    });
    console.log("Seeded document");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());