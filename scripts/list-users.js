const { PrismaClient } = require("@prisma/client");
const { PrismaLibSQL } = require("@prisma/adapter-libsql");
const { createClient } = require("@libsql/client");

function createPrisma() {
  if (process.env.TURSO_DATABASE_URL) {
    const libsql = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

const prisma = createPrisma();

async function main() {
  const users = await prisma.user.findMany({
    select: { name: true, email: true, role: true, active: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  });
  users.forEach(u =>
    console.log(`${u.role.padEnd(10)} ${(u.active ? 'actief' : 'inactief').padEnd(10)} ${u.email.padEnd(45)} ${u.name}`)
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
