import { describe, expect, it } from "vitest";
import { safeParseScreenshotParams } from "../schema";

describe("screenshot params schema", () => {
  it("accepts a minimal valid input with defaults", () => {
    const result = safeParseScreenshotParams({ url: "https://example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe("https://example.com");
      expect(result.data.format).toBe("png");
      expect(result.data.width).toBe(1280);
      expect(result.data.height).toBe(720);
      expect(result.data.quality).toBe(80);
      expect(result.data.cache_ttl).toBe(86400);
      expect(result.data.wait_until).toBe("networkidle2");
    }
  });

  it("rejects a non-http URL", () => {
    const result = safeParseScreenshotParams({ url: "ftp://example.com/file" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty URL", () => {
    const result = safeParseScreenshotParams({ url: "" });
    expect(result.success).toBe(false);
  });

  it("rejects width above the maximum", () => {
    const result = safeParseScreenshotParams({ url: "https://example.com", width: 9000 });
    expect(result.success).toBe(false);
  });

  it("rejects width below the minimum", () => {
    const result = safeParseScreenshotParams({ url: "https://example.com", width: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown format", () => {
    const result = safeParseScreenshotParams({ url: "https://example.com", format: "bmp" });
    expect(result.success).toBe(false);
  });

  it("accepts all supported formats", () => {
    for (const format of ["png", "jpeg", "jpg", "webp", "pdf"]) {
      const result = safeParseScreenshotParams({ url: "https://example.com", format });
      expect(result.success).toBe(true);
    }
  });

  it("coerces query-string style values", () => {
    const result = safeParseScreenshotParams({
      url: "https://example.com",
      width: "1920",
      full_page: "true",
      block_ads: "true",
      quality: "90",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.width).toBe(1920);
      expect(result.data.full_page).toBe(true);
      expect(result.data.block_ads).toBe(true);
      expect(result.data.quality).toBe(90);
    }
  });

  it("rejects out-of-range geolocation", () => {
    const badLat = safeParseScreenshotParams({
      url: "https://example.com",
      geolocation_latitude: 100,
    });
    expect(badLat.success).toBe(false);
    const badLng = safeParseScreenshotParams({
      url: "https://example.com",
      geolocation_longitude: 200,
    });
    expect(badLng.success).toBe(false);
  });

  it("accepts block_resources enum values and rejects unknown ones", () => {
    const ok = safeParseScreenshotParams({
      url: "https://example.com",
      block_resources: ["image", "font", "media"],
    });
    expect(ok.success).toBe(true);
    const bad = safeParseScreenshotParams({
      url: "https://example.com",
      block_resources: ["image", "popups"],
    });
    expect(bad.success).toBe(false);
  });

  it("rejects quality outside 1-100", () => {
    expect(
      safeParseScreenshotParams({ url: "https://example.com", quality: 0 }).success,
    ).toBe(false);
    expect(
      safeParseScreenshotParams({ url: "https://example.com", quality: 101 }).success,
    ).toBe(false);
  });
});
