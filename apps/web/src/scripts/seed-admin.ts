import bcrypt from "bcryptjs";

import { prisma } from "@/server/db";

async function main() {
  const email = String(process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const password = String(process.env.ADMIN_PASSWORD ?? "");

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD to seed the admin user.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    create: { email, role: "ADMIN", passwordHash, name: "Admin" },
    update: { role: "ADMIN", passwordHash }
  });

  console.log(`Seeded admin user: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
