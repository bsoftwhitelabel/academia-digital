import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const handler = NextAuth(authOptions);

export async function GET(req: Request, ctx: any) {
  return handler(req as any, ctx);
}

export async function POST(req: Request, ctx: any) {
  const url = new URL(req.url);
  // Rate-limit apenas no callback do login com credenciais
  if (url.pathname.endsWith("/callback/credentials")) {
    const ip = clientIp(req);
    const r = rateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
    if (!r.ok) {
      const minutes = Math.max(1, Math.ceil(r.retryAfterSec / 60));
      return NextResponse.json(
        {
          error: `Demasiadas tentativas. Tente novamente em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(r.retryAfterSec),
            "X-RateLimit-Remaining": String(r.remaining),
          },
        }
      );
    }
  }
  return handler(req as any, ctx);
}
