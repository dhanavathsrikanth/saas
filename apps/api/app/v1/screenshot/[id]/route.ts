import { database } from "@repo/database";
import { NotFoundError } from "@repo/screenshot-core";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { serializeJob } from "@/lib/capture-job";
import { toErrorResponse } from "@/lib/errors";

export const GET = async (
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  try {
    const ctx = await authenticateRequest(request);
    const { id } = await context.params;

    const job = await database.screenshotJob.findFirst({
      where: { id, orgId: ctx.orgId },
    });

    if (!job) {
      throw new NotFoundError("Screenshot job not found");
    }

    return NextResponse.json(serializeJob(job, false));
  } catch (error) {
    return toErrorResponse(error);
  }
};
