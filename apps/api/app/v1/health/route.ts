import { database } from "@repo/database";
import { NextResponse } from "next/server";

export const GET = async (): Promise<NextResponse> => {
  let db: "up" | "down" = "up";
  try {
    await database.$queryRaw`SELECT 1`;
  } catch {
    db = "down";
  }

  return NextResponse.json(
    {
      status: db === "up" ? "ok" : "degraded",
      database: db,
      version: "v1",
      time: new Date().toISOString(),
    },
    { status: db === "up" ? 200 : 503 },
  );
};
