import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, firstName: true },
  });

  const body = await req.json().catch(() => ({}));
  const phone = body.phone || user?.phone;
  if (!phone) {
    return NextResponse.json(
      { error: "Sem número associado. Indique um número ou actualize o seu perfil." },
      { status: 400 }
    );
  }

  await sendWhatsApp({
    to: phone,
    country: body.country || "PT",
    body: `[Teste] Olá ${user?.firstName || "Admin"}! Esta é uma mensagem de teste WhatsApp da Academia Digital. Se a recebeu, a integração está a funcionar.`,
    tenantId: session.user.tenantId,
    event: "INQUIRY_RECEIVED",
  });

  return NextResponse.json({ success: true, sentTo: phone });
}
