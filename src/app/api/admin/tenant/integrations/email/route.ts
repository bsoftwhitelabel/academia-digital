import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const updated = await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      emailFromName: body.fromName ?? undefined,
      emailFromAddress: body.fromAddress ?? undefined,
    },
  });
  await logAudit({
    action: "UPDATE",
    resource: "Tenant.Email",
    resourceId: updated.id,
    userId: session.user.id,
    tenantId: updated.id,
    changes: { after: { emailFromName: body.fromName, emailFromAddress: body.fromAddress } },
    req,
  });
  return NextResponse.json({ success: true });
}
