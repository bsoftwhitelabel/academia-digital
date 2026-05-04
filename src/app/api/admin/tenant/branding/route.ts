import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { logAudit, diffFields } from "@/lib/audit";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  try {
    const before = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
    });
    const updated = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        platformName: body.platformName ?? undefined,
        logoUrl: body.logoUrl !== undefined ? body.logoUrl : undefined,
        faviconUrl: body.faviconUrl !== undefined ? body.faviconUrl : undefined,
        primaryColor: body.primaryColor ?? undefined,
        accentColor: body.accentColor ?? undefined,
        emailFromName: body.emailFromName ?? undefined,
        emailFromAddress: body.emailFromAddress ?? undefined,
      },
    });
    try { revalidateTag(`tenant:${updated.id}`); } catch {}

    const diff = diffFields(before as any, updated as any, {
      ignore: ["logoUrl", "faviconUrl", "cssOverride"] as any,
    });
    await logAudit({
      action: "UPDATE",
      resource: "Tenant",
      resourceId: updated.id,
      userId: session.user.id,
      tenantId: updated.id,
      changes: diff,
      req,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("PUT /admin/tenant/branding error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
