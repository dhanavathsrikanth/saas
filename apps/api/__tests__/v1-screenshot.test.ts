import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/observability/error", () => ({
  parseError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));
vi.mock("@repo/observability/log", () => ({
  log: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

const state = {
  apiKeys: new Map<string, Record<string, unknown>>(),
  jobs: [] as Record<string, unknown>[],
  usageCount: 0,
};

vi.mock("@repo/database", () => ({
  database: {
    apiKey: {
      findUnique: vi.fn(async ({ where }: { where: { hash: string } }) =>
        state.apiKeys.get(where.hash) ?? null,
      ),
    },
    screenshotJob: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.cacheKey) {
          return (
            state.jobs.find(
              (j) => j.cacheKey === where.cacheKey && j.status === "completed",
            ) ?? null
          );
        }
        if (where.id) {
          return (
            state.jobs.find((j) => j.id === where.id && j.orgId === where.orgId) ?? null
          );
        }
        return null;
      }),
    },
    usageEvent: {
      count: vi.fn(async () => state.usageCount),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "usage_1",
        ...data,
        createdAt: new Date(),
      })),
    },
    $transaction: vi.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
      fn({
        screenshotJob: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            const job = {
              id: `job_${state.jobs.length + 1}`,
              ...data,
              createdAt: new Date(),
              completedAt: null,
            };
            state.jobs.push(job);
            return job;
          }),
        },
        usageEvent: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "usage_1",
            ...data,
            createdAt: new Date(),
          })),
        },
      }),
    ),
  },
}));

import { createHash } from "node:crypto";
import { GET as captureGet, POST } from "../app/v1/screenshot/route";
import { GET as getJob } from "../app/v1/screenshot/[id]/route";
import { resetMemoryBuckets } from "../lib/rate-limit-guard";

const TEST_KEY = "sk_test_gateway123";
const TEST_HASH = createHash("sha256").update(TEST_KEY).digest("hex");
const allowAll = async () => ["93.184.216.34"];

function authed(url: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-api-key": TEST_KEY },
  });
}

beforeEach(() => {
  state.apiKeys.clear();
  state.jobs.length = 0;
  state.usageCount = 0;
  resetMemoryBuckets();
  state.apiKeys.set(TEST_HASH, {
    id: "key_1",
    orgId: "org_1",
    plan: "free",
    rpm: 60,
    dailyCap: 1000,
    prefix: "sk_test_",
    revokedAt: null,
  });
});

describe("POST /v1/screenshot", () => {
  it("returns 401 without an API key", async () => {
    const res = await POST(new Request("http://localhost/v1/screenshot", { method: "POST" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for an unknown key", async () => {
    const res = await POST(
      new Request("http://localhost/v1/screenshot", {
        method: "POST",
        headers: { "x-api-key": "sk_test_nope" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for a revoked key", async () => {
    state.apiKeys.set(TEST_HASH, {
      id: "key_1",
      orgId: "org_1",
      plan: "free",
      rpm: 60,
      dailyCap: 1000,
      prefix: "sk_test_",
      revokedAt: new Date(),
    });
    const res = await POST(authed("http://localhost/v1/screenshot", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid params", async () => {
    const res = await POST(
      authed("http://localhost/v1/screenshot", {
        method: "POST",
        headers: { "x-api-key": TEST_KEY, "content-type": "application/json" },
        body: JSON.stringify({ url: "not-a-url", width: 99999 }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_PARAMS");
  });

  it("blocks SSRF targets", async () => {
    const res = await POST(
      authed("http://localhost/v1/screenshot", {
        method: "POST",
        headers: { "x-api-key": TEST_KEY, "content-type": "application/json" },
        body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data/" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("SSRF_BLOCKED");
  });

  it("creates a job and returns 202 with poll URL", async () => {
    const { createCaptureJob } = await import("../lib/capture-job");
    const res = await createCaptureJob(
      authed("http://localhost/v1/screenshot", { method: "POST" }),
      { url: "https://example.com", full_page: true },
      { resolver: allowAll },
    );
    expect(res.status).toBe(202);
    expect(res.headers.get("X-Cache")).toBe("MISS");
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe("pending");
    expect(body.poll_url).toBe(`/v1/screenshot/${body.id}`);
    expect(state.jobs).toHaveLength(1);
  });

  it("returns a cached completed job on repeat params", async () => {
    const { buildCacheKeyFromInput } = await import("@repo/screenshot-core");
    state.jobs.push({
      id: "job_cached",
      orgId: "org_1",
      status: "completed",
      url: "https://example.com",
      format: "png",
      width: 1280,
      height: 720,
      blobKey: null,
      cacheKey: buildCacheKeyFromInput({ url: "https://example.com" }),
      error: null,
      billedUnits: 1,
      durationMs: 1200,
      externalId: null,
      createdAt: new Date(),
      completedAt: new Date(),
    });
    const { createCaptureJob } = await import("../lib/capture-job");
    const res = await createCaptureJob(
      authed("http://localhost/v1/screenshot", { method: "POST" }),
      { url: "https://example.com" },
      { resolver: allowAll },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("HIT");
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.id).toBe("job_cached");
  });

  it("returns 402 when the daily quota is exhausted", async () => {
    state.usageCount = 1000;
    const { createCaptureJob } = await import("../lib/capture-job");
    const res = await createCaptureJob(
      authed("http://localhost/v1/screenshot", { method: "POST" }),
      { url: "https://example.com" },
      { resolver: allowAll },
    );
    expect(res.status).toBe(402);
  });

  it("returns 429 when the per-minute rate limit is exceeded", async () => {
    state.apiKeys.set(TEST_HASH, {
      id: "key_1",
      orgId: "org_1",
      plan: "free",
      rpm: 1,
      dailyCap: 1000,
      prefix: "sk_test_",
      revokedAt: null,
    });
    const { createCaptureJob } = await import("../lib/capture-job");
    const first = await createCaptureJob(
      authed("http://localhost/v1/screenshot", { method: "POST" }),
      { url: "https://example.com" },
      { resolver: allowAll },
    );
    expect(first.status).toBe(202);
    const second = await createCaptureJob(
      authed("http://localhost/v1/screenshot", { method: "POST" }),
      { url: "https://example.com/other" },
      { resolver: allowAll },
    );
    expect(second.status).toBe(429);
    const body = await second.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("GET handler parses query params (SSRF rejected before DNS)", async () => {
    const res = await captureGet(
      authed("http://localhost/v1/screenshot?url=http://10.0.0.5/admin&width=1920&full_page=true"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("SSRF_BLOCKED");
  });

  it("GET handler coerces query-string types", async () => {
    const input = (await import("../lib/capture-job")).parseQueryInput(
      new URLSearchParams("url=https://example.com&width=1920&full_page=true&block_resources=image,font"),
    );
    expect(input).toMatchObject({
      url: "https://example.com",
      width: "1920",
      full_page: "true",
      block_resources: ["image", "font"],
    });
  });
});

describe("GET /v1/screenshot/[id]", () => {
  it("returns 404 for jobs in another org", async () => {
    state.jobs.push({
      id: "job_other",
      orgId: "org_2",
      status: "pending",
      url: "https://example.com",
      format: "png",
      width: 1280,
      height: 720,
      blobKey: null,
      error: null,
      billedUnits: 1,
      durationMs: null,
      externalId: null,
      createdAt: new Date(),
      completedAt: null,
    });
    const res = await getJob(authed("http://localhost/v1/screenshot/job_other"), {
      params: Promise.resolve({ id: "job_other" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns the job for the owning org", async () => {
    state.jobs.push({
      id: "job_mine",
      orgId: "org_1",
      status: "pending",
      url: "https://example.com",
      format: "png",
      width: 1280,
      height: 720,
      blobKey: null,
      error: null,
      billedUnits: 1,
      durationMs: null,
      externalId: "ext-1",
      createdAt: new Date(),
      completedAt: null,
    });
    const res = await getJob(authed("http://localhost/v1/screenshot/job_mine"), {
      params: Promise.resolve({ id: "job_mine" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("job_mine");
    expect(body.external_id).toBe("ext-1");
  });
});
