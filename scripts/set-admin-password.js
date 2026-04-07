const { PrismaClient } = require("@prisma/client");
const { PrismaLibSQL } = require("@prisma/adapter-libsql");
const { createClient } = require("@libsql/client");
const bcrypt = require("bcryptjs");

function createPrisma() {
  if (process.env.TURSO_DATABASE_URL) {
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

const prisma = createPrisma();

async function main() {
  const email = "administratie@nolimitsafety.nl";
  const passwordHash = await bcrypt.hash("admin123", 12);

  const updated = await prisma.user.update({
    where: { email },
    data: { passwordHash, active: true },
    select: { id: true, email: true, role: true, active: true },
  });

  console.log(JSON.stringify(updated, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
