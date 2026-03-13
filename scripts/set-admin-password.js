const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin1@test.nl';
  const passwordHash = await bcrypt.hash('admin123', 12);

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
