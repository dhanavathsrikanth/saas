import { createHash } from "node:crypto";
import type { ScreenshotParams } from "./schema";

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSort);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = stableSort((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

const DEFAULTS: Record<string, unknown> = {
  format: "png",
  width: 1280,
  height: 720,
  full_page: false,
  scale_factor: 1,
  wait_until: "networkidle2",
  wait_for_timeout: 0,
  delay: 0,
  dark_mode: false,
  reduced_motion: false,
  media_type: "screen",
  quality: 80,
  hide_selectors: [],
  block_ads: false,
  block_cookie_banners: false,
  block_trackers: false,
  block_resources: [],
  block_requests: [],
  stealth_mode: false,
  cache_ttl: 86400,
  output_type: "binary",
};

function stripDefaults(params: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key in DEFAULTS && JSON.stringify(value) === JSON.stringify(DEFAULTS[key])) {
      continue;
    }
    if (value === undefined || value === null || value === "") {
      continue;
    }
    stripped[key] = value;
  }
  return stripped;
}

export function buildCacheKey(params: ScreenshotParams): string {
  const stripped = stripDefaults(params as unknown as Record<string, unknown>);
  const canonical = JSON.stringify(stableSort(stripped));
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildCacheKeyFromInput(input: Record<string, unknown>): string {
  const stripped = stripDefaults(input);
  const canonical = JSON.stringify(stableSort(stripped));
  return createHash("sha256").update(canonical).digest("hex");
}
