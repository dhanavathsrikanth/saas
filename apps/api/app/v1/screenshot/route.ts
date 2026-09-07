import { InvalidParamsError } from "@repo/screenshot-core";
import { NextResponse } from "next/server";
import { createCaptureJob, parseQueryInput } from "@/lib/capture-job";
import { toErrorResponse } from "@/lib/errors";

export const POST = async (request: Request): Promise<NextResponse> => {
  const text = await request.text();
  if (!text) {
    return createCaptureJob(request, {});
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return toErrorResponse(new InvalidParamsError("Request body must be valid JSON"));
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return toErrorResponse(new InvalidParamsError("Request body must be a JSON object"));
  }
  return createCaptureJob(request, body as Record<string, unknown>);
};

export const GET = async (request: Request): Promise<NextResponse> => {
  const { searchParams } = new URL(request.url);
  return createCaptureJob(request, parseQueryInput(searchParams));
};
