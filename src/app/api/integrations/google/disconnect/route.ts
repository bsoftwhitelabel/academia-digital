import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      googleCalendarTokens: undefined as any,
      googleCalendarEnabled: false,
    },
  });

  await logAudit({
    action: "UPDATE",
    resource: "Tenant",
    resourceId: session.user.tenantId,
    userId: session.user.id,
    tenantId: session.user.tenantId,
    changes: { after: { googleCalendarEnabled: false } },
    req,
  });

  return NextResponse.json({ success: true });
}
