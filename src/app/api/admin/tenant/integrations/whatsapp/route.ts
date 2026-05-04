import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { notifConfig: true },
  });
  const cfg = (tenant?.notifConfig as any)?.whatsapp || {};
  // Mascarar credenciais
  const masked = {
    enabled: cfg.enabled !== false,
    accountSid: cfg.accountSid ? "•".repeat(12) + String(cfg.accountSid).slice(-4) : "",
    authToken: cfg.authToken ? "•".repeat(12) + "****" : "",
    fromNumber: cfg.fromNumber || "",
    events: cfg.events || {},
  };
  return NextResponse.json(masked);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { notifConfig: true },
  });
  const existing = (tenant?.notifConfig as any) || {};
  const wpExisting = existing.whatsapp || {};

  const merged = {
    ...existing,
    whatsapp: {
      enabled: body.enabled !== undefined ? !!body.enabled : (wpExisting.enabled !== false),
      // Manter valor existente se body não enviar (permite editar só os toggles sem reescrever credenciais)
      accountSid: body.accountSid !== undefined && body.accountSid !== "" ? body.accountSid : wpExisting.accountSid,
      authToken: body.authToken !== undefined && body.authToken !== "" ? body.authToken : wpExisting.authToken,
      fromNumber: body.fromNumber !== undefined ? body.fromNumber : wpExisting.fromNumber,
      events: { ...(wpExisting.events || {}), ...(body.events || {}) },
    },
  };

  const updated = await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { notifConfig: merged as any },
  });

  await logAudit({
    action: "UPDATE",
    resource: "Tenant.WhatsApp",
    resourceId: updated.id,
    userId: session.user.id,
    tenantId: updated.id,
    changes: { after: { enabled: merged.whatsapp.enabled, events: merged.whatsapp.events } },
    req,
  });

  return NextResponse.json({ success: true });
}
