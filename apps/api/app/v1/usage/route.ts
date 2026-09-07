import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/errors";
import { getOrgUsage, PLAN_MONTHLY_QUOTA, startOfMonthUtc } from "@/lib/quotas";

export const GET = async (request: Request): Promise<NextResponse> => {
  try {
    const ctx = await authenticateRequest(request);
    const now = new Date();
    const { dailyUsed, monthlyUsed } = await getOrgUsage(ctx.orgId, now);
    const monthlyLimit = PLAN_MONTHLY_QUOTA[ctx.plan] ?? PLAN_MONTHLY_QUOTA.free ?? 100;
    const periodStart = startOfMonthUtc(now);

    return NextResponse.json({
      org_id: ctx.orgId,
      plan: ctx.plan,
      period: {
        start: periodStart.toISOString(),
        end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
      },
      monthly: {
        used: monthlyUsed,
        limit: monthlyLimit === Number.POSITIVE_INFINITY ? null : monthlyLimit,
        remaining: monthlyLimit === Number.POSITIVE_INFINITY ? null : Math.max(0, monthlyLimit - monthlyUsed),
      },
      daily: {
        used: dailyUsed,
        cap: ctx.dailyCap,
        remaining: Math.max(0, ctx.dailyCap - dailyUsed),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
};
