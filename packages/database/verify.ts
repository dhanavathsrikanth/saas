import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "./generated/client";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const db = new PrismaClient({ adapter });

async function main() {
  const orgs = await db.organization.findMany();
  const keys = await db.apiKey.findMany();
  const jobs = await db.screenshotJob.count();
  console.log("Organizations:", JSON.stringify(orgs));
  console.log("ApiKeys:", JSON.stringify(keys));
  console.log("ScreenshotJob count:", jobs);

  const key = keys[0];
  if (key) {
    console.log("Hash of 'sk_test_demokey12345':", key.hash);
    console.log("Lookup by prefix:", key.prefix);
  }
}

main().finally(() => db.$disconnect());
