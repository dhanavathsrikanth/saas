import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/observability/error", () => ({
  parseError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));
vi.mock("@repo/observability/log", () => ({
  log: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

const state = {
  key: null as Record<string, unknown> | null,
  usageCount: 0,
  queryRawOk: true,
};

vi.mock("@repo/database", () => ({
  database: {
    apiKey: {
      findUnique: vi.fn(async () => state.key),
    },
    usageEvent: {
      count: vi.fn(async () => state.usageCount),
    },
    $queryRaw: vi.fn(async () => {
      if (!state.queryRawOk) {
        throw new Error("db down");
      }
      return [{ "?column?": 1 }];
    }),
  },
}));

import { createHash } from "node:crypto";
import { GET as usageGet } from "../app/v1/usage/route";
import { GET as healthGet } from "../app/v1/health/route";

const TEST_KEY = "sk_test_gateway123";
const TEST_HASH = createHash("sha256").update(TEST_KEY).digest("hex");

function authed(url: string): Request {
  return new Request(url, { headers: { "x-api-key": TEST_KEY } });
}

beforeEach(() => {
  state.usageCount = 0;
  state.queryRawOk = true;
  state.key = {
    id: "key_1",
    orgId: "org_1",
    plan: "pro",
    rpm: 60,
    dailyCap: 1000,
    prefix: "sk_test_",
    revokedAt: null,
  };
});

describe("GET /v1/usage", () => {
  it("returns 401 without a key", async () => {
    const res = await usageGet(new Request("http://localhost/v1/usage"));
    expect(res.status).toBe(401);
  });

  it("returns the usage shape", async () => {
    state.usageCount = 42;
    const res = await usageGet(authed("http://localhost/v1/usage"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.org_id).toBe("org_1");
    expect(body.plan).toBe("pro");
    expect(body.monthly.used).toBe(42);
    expect(body.monthly.limit).toBe(10000);
    expect(body.monthly.remaining).toBe(9958);
    expect(body.daily.cap).toBe(1000);
    expect(body.daily.remaining).toBe(958);
    expect(body.period.start).toBeDefined();
  });

  it("returns null limits for enterprise", async () => {
    state.key = { ...(state.key as object), plan: "enterprise" };
    const res = await usageGet(authed("http://localhost/v1/usage"));
    const body = await res.json();
    expect(body.monthly.limit).toBeNull();
    expect(body.monthly.remaining).toBeNull();
  });
});

describe("GET /v1/health", () => {
  it("returns ok when the database pings", async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("up");
  });

  it("returns 503 degraded when the database is down", async () => {
    state.queryRawOk = false;
    const res = await healthGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.database).toBe("down");
  });
});

export { TEST_HASH };
