import { NextResponse } from "next/server";
import { _resetRateLimit } from "@/lib/rate-limit";

// Apenas em dev — devolve 404 em produção.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  _resetRateLimit();
  return NextResponse.json({ ok: true });
}
