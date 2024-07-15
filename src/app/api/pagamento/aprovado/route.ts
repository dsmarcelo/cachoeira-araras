import { api } from "@/trpc/server";
import { type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queries = Object.fromEntries(searchParams.entries());
  const { payment_id, status, merchant_order_id } = queries;

  // Validate the input
  if (!payment_id || !status || !merchant_order_id) {
    return new Response(JSON.stringify("Missing required fields"), {
      status: 405,
    });
  }

  return Response.json(queries);
}
