// src/app/api/check-referrer/route.ts
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const referrer = req.headers.get("referer") ?? req.headers.get("referrer");
  return NextResponse.json(referrer);
}
