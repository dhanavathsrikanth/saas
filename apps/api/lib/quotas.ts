import { database } from "@repo/database";
import { PaymentRequiredError } from "@repo/screenshot-core";

export const PLAN_MONTHLY_QUOTA: Record<string, number> = {
  free: 100,
  basic: 2000,
  pro: 10000,
  scale: 50000,
  enterprise: Number.POSITIVE_INFINITY,
};

export function startOfDayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getOrgUsage(orgId: string, now = new Date()) {
  const [dailyUsed, monthlyUsed] = await Promise.all([
    database.usageEvent.count({
      where: { orgId, createdAt: { gte: startOfDayUtc(now) } },
    }),
    database.usageEvent.count({
      where: { orgId, createdAt: { gte: startOfMonthUtc(now) } },
    }),
  ]);
  return { dailyUsed, monthlyUsed };
}

export async function enforceQuota(
  orgId: string,
  plan: string,
  dailyCap: number,
  now = new Date(),
): Promise<{ dailyUsed: number; monthlyUsed: number; monthlyLimit: number }> {
  const monthlyLimit = PLAN_MONTHLY_QUOTA[plan] ?? PLAN_MONTHLY_QUOTA.free ?? 100;
  const { dailyUsed, monthlyUsed } = await getOrgUsage(orgId, now);

  if (dailyUsed >= dailyCap) {
    throw new PaymentRequiredError(
      `Daily quota exceeded (${dailyUsed}/${dailyCap}). Quota resets at midnight UTC.`,
    );
  }

  if (monthlyUsed >= monthlyLimit) {
    throw new PaymentRequiredError(
      `Monthly plan quota exceeded (${monthlyUsed}/${monthlyLimit}). Please upgrade your plan.`,
    );
  }

  return { dailyUsed, monthlyUsed, monthlyLimit };
}
