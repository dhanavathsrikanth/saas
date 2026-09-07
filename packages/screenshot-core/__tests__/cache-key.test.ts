import { describe, expect, it } from "vitest";
import { buildCacheKey, buildCacheKeyFromInput } from "../cache-key";
import { parseScreenshotParams } from "../schema";

describe("cache key", () => {
  it("is deterministic for identical params", () => {
    const a = parseScreenshotParams({ url: "https://example.com" });
    const b = parseScreenshotParams({ url: "https://example.com" });
    expect(buildCacheKey(a)).toBe(buildCacheKey(b));
  });

  it("is stable across key order", () => {
    const k1 = buildCacheKeyFromInput({ url: "https://example.com", width: 1920, dark_mode: true });
    const k2 = buildCacheKeyFromInput({ dark_mode: true, width: 1920, url: "https://example.com" });
    expect(k1).toBe(k2);
  });

  it("strips default values so explicit defaults hit the same entry", () => {
    const implicit = buildCacheKeyFromInput({ url: "https://example.com" });
    const explicit = buildCacheKeyFromInput({
      url: "https://example.com",
      width: 1280,
      height: 720,
      format: "png",
      full_page: false,
    });
    expect(implicit).toBe(explicit);
  });

  it("differs when meaningful params differ", () => {
    const base = parseScreenshotParams({ url: "https://example.com" });
    const dark = parseScreenshotParams({ url: "https://example.com", dark_mode: true });
    const wide = parseScreenshotParams({ url: "https://example.com", width: 1920 });
    expect(buildCacheKey(base)).not.toBe(buildCacheKey(dark));
    expect(buildCacheKey(base)).not.toBe(buildCacheKey(wide));
  });

  it("returns a 64-char hex sha256", () => {
    const key = buildCacheKeyFromInput({ url: "https://example.com" });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
