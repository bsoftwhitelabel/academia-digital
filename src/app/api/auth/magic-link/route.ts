import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Resend } from "resend";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`magic-link:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.ok) {
      const minutes = Math.max(1, Math.ceil(rl.retryAfterSec / 60));
      return NextResponse.json(
        { error: `Demasiadas tentativas. Tente novamente em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const { email, sessionId } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    await prisma.magicLink.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    // O sessionId pode ser usado no redirect após o login, então passamos via query string
    const magicLinkUrl = `${appUrl}/auth/magic/${token}${sessionId ? `?sessionId=${sessionId}` : ''}`;

    if (resend) {
      await resend.emails.send({
        from: "Academia Digital <no-reply@resend.dev>", 
        to: [email],
        subject: "Seu link de acesso - Academia Digital",
        html: `<p>Olá, ${user.firstName}!</p>
               <p>Aqui está o seu link de acesso seguro:</p>
               <p><a href="${magicLinkUrl}">${magicLinkUrl}</a></p>
               <p>Este link expira em 48 horas.</p>`,
      });
    }

    return NextResponse.json({ success: true, message: "Magic link sent" });
  } catch (error) {
    console.error("Magic link error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
