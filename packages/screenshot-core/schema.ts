import { z } from "zod";

const formatEnum = z.enum(["png", "jpeg", "jpg", "webp", "pdf"]);
const waitUntilEnum = z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2", "networkidle"]);
const mediaTypeEnum = z.enum(["screen", "print"]);
const resourceTypeEnum = z.enum([
  "document",
  "stylesheet",
  "image",
  "media",
  "font",
  "script",
  "texttrack",
  "xhr",
  "fetch",
  "eventsource",
  "websocket",
  "manifest",
  "other",
]);
const outputTypeEnum = z.enum(["binary", "base64", "url"]);

export const screenshotParamsSchema = z.object({
  // Core
  url: z.string().min(1).startsWith("http", "URL must start with http:// or https://"),
  format: formatEnum.default("png"),

  // Viewport
  width: z.coerce.number().int().min(1).max(7680).default(1280),
  height: z.coerce.number().int().min(1).max(4320).default(720),
  full_page: z.coerce.boolean().default(false),
  scale_factor: z.coerce.number().min(1).max(3).default(1),
  device_scale_factor: z.coerce.number().min(1).max(3).optional(),
  viewport_device: z.string().optional(),

  // Delay / timing
  wait_until: waitUntilEnum.default("networkidle2"),
  wait_for_timeout: z.coerce.number().int().min(0).max(60000).default(0),
  wait_for_selector: z.string().max(1000).optional(),
  delay: z.coerce.number().int().min(0).max(60000).default(0),

  // Visual
  dark_mode: z.coerce.boolean().default(false),
  reduced_motion: z.coerce.boolean().default(false),
  media_type: mediaTypeEnum.default("screen"),

  // Capture
  selector: z.string().max(1000).optional(),
  clip_width: z.coerce.number().int().min(1).max(7680).optional(),
  clip_height: z.coerce.number().int().min(1).max(4320).optional(),
  clip_x: z.coerce.number().int().min(0).max(7680).optional(),
  clip_y: z.coerce.number().int().min(0).max(4320).optional(),
  quality: z.coerce.number().int().min(1).max(100).default(80),
  hide_selectors: z.array(z.string().max(500)).max(50).default([]),
  modify_css: z.string().max(20000).optional(),

  // Privacy / blocking
  block_ads: z.coerce.boolean().default(false),
  block_cookie_banners: z.coerce.boolean().default(false),
  block_trackers: z.coerce.boolean().default(false),
  block_resources: z.array(resourceTypeEnum).default([]),
  block_requests: z.array(z.string().max(500)).max(100).default([]),

  // Auth / session
  browser_cookies: z.string().max(50000).optional(),
  scripts: z.string().max(50000).optional(),

  // Anti-bot
  stealth_mode: z.coerce.boolean().default(false),
  user_agent: z.string().max(1000).optional(),
  headers: z.string().max(10000).optional(),
  proxy: z.string().max(2000).optional(),

  // Geolocation
  geolocation_latitude: z.coerce.number().min(-90).max(90).optional(),
  geolocation_longitude: z.coerce.number().min(-180).max(180).optional(),
  timezone: z.string().max(100).optional(),
  locale: z.string().max(20).optional(),

  // Output / caching
  cache_ttl: z.coerce.number().int().min(0).max(2592000).default(86400),
  output_type: outputTypeEnum.default("binary"),
});

export type ScreenshotParams = z.infer<typeof screenshotParamsSchema>;

export type ScreenshotParamsInput = z.input<typeof screenshotParamsSchema>;

export function parseScreenshotParams(input: unknown): ScreenshotParams {
  return screenshotParamsSchema.parse(input);
}

export function safeParseScreenshotParams(input: unknown) {
  return screenshotParamsSchema.safeParse(input);
}
