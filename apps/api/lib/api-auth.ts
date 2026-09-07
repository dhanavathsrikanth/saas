import { createHash } from "node:crypto";
import { database } from "@repo/database";
import { UnauthorizedError } from "@repo/screenshot-core";

export interface ApiKeyContext {
  keyId: string;
  orgId: string;
  plan: "free" | "basic" | "pro" | "scale" | "enterprise";
  rpm: number;
  dailyCap: number;
  keyPrefix: string;
}

export function extractApiKey(request: Request): string {
  const header =
    request.headers.get("x-api-key") ?? request.headers.get("authorization");

  if (!header) {
    throw new UnauthorizedError("Missing API key. Send it as x-api-key header.");
  }

  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();

  if (!key) {
    throw new UnauthorizedError("Missing API key. Send it as x-api-key header.");
  }

  return key;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function authenticateRequest(request: Request): Promise<ApiKeyContext> {
  const key = extractApiKey(request);
  const hash = hashApiKey(key);

  const record = await database.apiKey.findUnique({
    where: { hash },
    select: {
      id: true,
      orgId: true,
      plan: true,
      rpm: true,
      dailyCap: true,
      prefix: true,
      revokedAt: true,
    },
  });

  if (!record || record.revokedAt) {
    throw new UnauthorizedError("Invalid or revoked API key.");
  }

  return {
    keyId: record.id,
    orgId: record.orgId,
    plan: record.plan,
    rpm: record.rpm,
    dailyCap: record.dailyCap,
    keyPrefix: record.prefix,
  };
}
