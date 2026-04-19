const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

/**
 * Keeps local/staging DBs usable when `prisma migrate deploy` was not run yet.
 * Matches migration `0002_user_email_verified` (PostgreSQL 11+).
 */
async function ensureEmailVerifiedColumn(prisma) {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3)`
    );
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "emailVerified" = COALESCE("emailVerified", "createdAt")
      WHERE "emailVerified" IS NULL
    `);
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/syntax error/i.test(msg) && /IF NOT EXISTS/i.test(msg)) {
      console.error(
        "[seed] Your PostgreSQL version may not support ADD COLUMN IF NOT EXISTS. Upgrade PG or run: npx prisma migrate deploy"
      );
    }
    throw e;
  }
}

async function main() {
  const email = String(process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const password = String(process.env.ADMIN_PASSWORD ?? "");

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD to seed the admin user.");
  }

  const prisma = new PrismaClient();
  try {
    await ensureEmailVerifiedColumn(prisma);

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        role: "ADMIN",
        passwordHash,
        name: "Admin",
        emailVerified: new Date()
      },
      update: { role: "ADMIN", passwordHash, emailVerified: new Date() }
    });

    console.log(`Seeded admin user: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
