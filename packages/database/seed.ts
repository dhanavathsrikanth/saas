import "dotenv/config";
import { createHash } from "node:crypto";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "./generated/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL as string,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.upsert({
    where: { clerkId: "test_org" },
    update: {},
    create: {
      clerkId: "test_org",
      plan: "free",
    },
  });

  const fullKey = "sk_test_demokey12345";
  const hash = createHash("sha256").update(fullKey).digest("hex");

  await prisma.apiKey.upsert({
    where: { hash },
    update: {},
    create: {
      orgId: org.clerkId,
      name: "Demo Key",
      hash,
      prefix: fullKey.slice(0, 8),
      plan: "free",
      rpm: 10,
      dailyCap: 1000,
    },
  });

  console.log("Seeded organization:", org.clerkId);
  console.log("Seeded API key prefix: sk_test_dem");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
