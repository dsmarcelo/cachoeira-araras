// src/app/api/check-referrer/route.ts
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const referer = req.headers.get("referer") ?? req.headers.get("referrer");

  const cameFromInstagram = referer ? referer.includes("instagram.com") : false;

  return NextResponse.json({ cameFromInstagram });
}
