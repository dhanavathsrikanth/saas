import { database, type Prisma } from "@repo/database";
import {
  buildCacheKey,
  safeParseScreenshotParams,
  type DnsResolver,
  type ScreenshotParams,
  validateUrl,
} from "@repo/screenshot-core";
import { authenticateRequest, type ApiKeyContext } from "./api-auth";
import { toErrorResponse, withHeaders } from "./errors";
import { enforceQuota } from "./quotas";
import { checkRateLimit, rateLimitHeaders } from "./rate-limit-guard";
import { RateLimitedError } from "@repo/screenshot-core";
import { NextResponse } from "next/server";

export interface JobExtras {
  webhookUrl?: string;
  externalId?: string;
}

interface Authenticated {
  ctx: ApiKeyContext;
  headers: Record<string, string>;
}

export async function requireAuthAndRateLimit(request: Request): Promise<Authenticated> {
  const ctx = await authenticateRequest(request);
  const decision = await checkRateLimit(`key:${ctx.keyId}`, ctx.rpm);
  const headers = rateLimitHeaders(decision);
  if (!decision.success) {
    throw new RateLimitedError(`Rate limit exceeded (${ctx.rpm} requests/minute)`, Math.max(0, Math.ceil((decision.reset - Date.now()) / 1000)));
  }
  return { ctx, headers };
}

export function parseQueryInput(searchParams: URLSearchParams): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const arrays = ["block_resources", "hide_selectors", "block_requests"];
  for (const [key, value] of searchParams.entries()) {
    if (arrays.includes(key)) {
      const existing = input[key];
      const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
      input[key] = [...((existing as string[] | undefined) ?? []), ...parts];
    } else if (!(key in input)) {
      input[key] = value;
    }
  }
  return input;
}

export function extractJobExtras(input: Record<string, unknown>): { cleaned: Record<string, unknown>; extras: JobExtras } {
  const { webhook_url, external_id, ...rest } = input;
  const extras: JobExtras = {};
  if (typeof webhook_url === "string" && webhook_url.length > 0) {
    try {
      const parsed = new URL(webhook_url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        extras.webhookUrl = webhook_url;
      }
    } catch {
      // ignore invalid webhook URLs — stored as undefined
    }
  }
  if (typeof external_id === "string" && external_id.length > 0) {
    extras.externalId = external_id.slice(0, 255);
  }
  return { cleaned: rest, extras };
}

export interface JobResponse {
  id: string;
  status: string;
  url: string;
  format: string;
  width: number | null;
  height: number | null;
  cached: boolean;
  result_url: string | null;
  error: string | null;
  billed_units: number;
  duration_ms: number | null;
  external_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export function serializeJob(job: {
  id: string;
  status: string;
  url: string;
  format: string;
  width: number | null;
  height: number | null;
  blobKey: string | null;
  error: string | null;
  billedUnits: number;
  durationMs: number | null;
  externalId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}, cached: boolean): JobResponse {
  return {
    id: job.id,
    status: job.status,
    url: job.url,
    format: job.format,
    width: job.width,
    height: job.height,
    cached,
    result_url: job.blobKey,
    error: job.error,
    billed_units: job.billedUnits,
    duration_ms: job.durationMs,
    external_id: job.externalId,
    created_at: job.createdAt.toISOString(),
    completed_at: job.completedAt ? job.completedAt.toISOString() : null,
  };
}

export async function createCaptureJob(
  request: Request,
  rawInput: Record<string, unknown>,
  opts?: { resolver?: DnsResolver },
): Promise<NextResponse> {
  try {
    const { ctx, headers } = await requireAuthAndRateLimit(request);
    const { cleaned, extras } = extractJobExtras(rawInput);

    const parsed = safeParseScreenshotParams(cleaned);
    if (!parsed.success) {
      return withHeaders(toErrorResponse(parsed.error), headers);
    }
    const params: ScreenshotParams = parsed.data;

    await validateUrl(params.url, opts?.resolver);

    const cacheKey = buildCacheKey(params);
    if (params.cache_ttl > 0) {
      const freshSince = new Date(Date.now() - params.cache_ttl * 1000);
      const hit = await database.screenshotJob.findFirst({
        where: { cacheKey, status: "completed", createdAt: { gte: freshSince } },
        orderBy: { createdAt: "desc" },
      });
      if (hit) {
        return withHeaders(
          NextResponse.json({ ...serializeJob(hit, true) }, { status: 200, headers: { "X-Cache": "HIT" } }),
          headers,
        );
      }
    }

    await enforceQuota(ctx.orgId, ctx.plan, ctx.dailyCap);

    const job = await database.$transaction(async (tx) => {
      const created = await tx.screenshotJob.create({
        data: {
          orgId: ctx.orgId,
          apiKeyId: ctx.keyId,
          status: "pending",
          paramsJson: params as unknown as Prisma.InputJsonValue,
          url: params.url,
          format: params.format,
          cacheKey,
          width: params.viewport_device ? null : params.width,
          height: params.viewport_device ? null : params.height,
          webhookUrl: extras.webhookUrl,
          externalId: extras.externalId,
          billedUnits: 1,
        },
      });
      await tx.usageEvent.create({
        data: { orgId: ctx.orgId, type: "screenshot", billedUnits: 1 },
      });
      return created;
    });

    return withHeaders(
      NextResponse.json(
        {
          id: job.id,
          status: job.status,
          cached: false,
          poll_url: `/v1/screenshot/${job.id}`,
          external_id: job.externalId,
          created_at: job.createdAt.toISOString(),
        },
        { status: 202, headers: { "X-Cache": "MISS" } },
      ),
      headers,
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
