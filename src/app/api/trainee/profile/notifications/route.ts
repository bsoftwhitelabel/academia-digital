import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "TRAINEE" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { notifEmail, notifWhatsApp, phone } = body || {};

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notifEmail: notifEmail !== undefined ? !!notifEmail : undefined,
        notifWhatsApp: notifWhatsApp !== undefined ? !!notifWhatsApp : undefined,
        phone: phone !== undefined ? phone : undefined,
      },
      select: { notifEmail: true, notifWhatsApp: true, phone: true },
    });

    // Sincronizar Trainee.phone também (campo paralelo no schema)
    await prisma.trainee.updateMany({
      where: { userId: session.user.id },
      data: { phone: updated.phone },
    });

    await logAudit({
      action: "UPDATE",
      resource: "User.NotificationPrefs",
      resourceId: session.user.id,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      changes: { after: updated },
      req,
    });

    return NextResponse.json({ success: true, ...updated });
  } catch (e: any) {
    console.error("[notif prefs] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
