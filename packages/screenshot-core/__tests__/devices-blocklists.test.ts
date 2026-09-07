import { describe, expect, it } from "vitest";
import { deviceNames, devices, getDevice } from "../devices";
import { buildCookieBannerHidingCss, COOKIE_BANNER_SELECTORS } from "../blocklist-cookies";
import { AD_PATTERNS, matchesAdPattern } from "../blocklist-ads";

describe("device presets", () => {
  it("has at least 30 presets", () => {
    expect(devices.length).toBeGreaterThanOrEqual(30);
  });

  it("resolves iphone_16_pro with mobile + touch", () => {
    const d = getDevice("iphone_16_pro");
    expect(d).toBeDefined();
    expect(d?.mobile).toBe(true);
    expect(d?.touch).toBe(true);
    expect(d?.width).toBe(402);
    expect(d?.userAgent).toContain("iPhone");
  });

  it("resolves a desktop preset without mobile flags", () => {
    const d = getDevice("desktop_1920x1080");
    expect(d).toBeDefined();
    expect(d?.mobile).toBe(false);
    expect(d?.touch).toBe(false);
  });

  it("returns undefined for unknown devices", () => {
    expect(getDevice("nokia_3310")).toBeUndefined();
  });

  it("deviceNames matches devices", () => {
    expect(deviceNames).toHaveLength(devices.length);
    expect(deviceNames).toContain("pixel_9_pro");
    expect(deviceNames).toContain("macbook_pro_16");
  });

  it("every preset has a valid viewport and UA", () => {
    for (const d of devices) {
      expect(d.width).toBeGreaterThan(0);
      expect(d.height).toBeGreaterThan(0);
      expect(d.userAgent.length).toBeGreaterThan(10);
    }
  });
});

describe("ad blocklist", () => {
  it("has patterns", () => {
    expect(AD_PATTERNS.length).toBeGreaterThan(50);
  });

  it("matches known ad domains", () => {
    expect(matchesAdPattern("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")).toBe(true);
    expect(matchesAdPattern("https://ads.yahoo.com/video")).toBe(true);
  });

  it("does not match normal content", () => {
    expect(matchesAdPattern("https://example.com/articles/hello")).toBe(false);
  });
});

describe("cookie banner blocklist", () => {
  it("has selectors", () => {
    expect(COOKIE_BANNER_SELECTORS.length).toBeGreaterThan(50);
  });

  it("builds hiding CSS", () => {
    const css = buildCookieBannerHidingCss(["#onetrust-banner-sdk"]);
    expect(css).toContain("#onetrust-banner-sdk");
    expect(css).toContain("display: none !important");
  });
});
