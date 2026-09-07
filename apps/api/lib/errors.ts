import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { ScreenshotError } from "@repo/screenshot-core";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ScreenshotError) {
    return NextResponse.json(error.toJSON(), {
      status: error.statusCode,
      headers:
        error.code === "RATE_LIMITED"
          ? { "Retry-After": String((error.details as { retry_after_seconds?: number } | undefined)?.retry_after_seconds ?? 60) }
          : undefined,
    });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PARAMS",
          message: "Invalid request parameters",
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  const message = parseError(error);
  log.error(message);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
    { status: 500 },
  );
}

export function withHeaders(response: NextResponse, headers: Record<string, string>): NextResponse {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
