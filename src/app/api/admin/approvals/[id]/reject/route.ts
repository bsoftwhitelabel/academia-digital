import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ar = await prisma.approvalRequest.findUnique({ where: { id: params.id } });
  if (!ar) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ar.tenantId !== session.user.tenantId && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cross-tenant" }, { status: 403 });
  }
  if (ar.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const notes = (body.notes || "").trim();
  if (!notes) {
    return NextResponse.json(
      { error: "Notas obrigatórias ao rejeitar" },
      { status: 400 }
    );
  }

  const now = new Date();
  await prisma.approvalRequest.update({
    where: { id: ar.id },
    data: {
      status: "REJECTED",
      reviewedById: session.user.id,
      reviewedAt: now,
      reviewNotes: notes,
    },
  });

  if (ar.type === "ENROLLMENT") {
    await prisma.enrollment.update({
      where: { id: ar.resourceId },
      data: { status: "CANCELLED" },
    });
  } else if (ar.type === "TRAINING_PLAN") {
    await prisma.trainingPlan.update({
      where: { id: ar.resourceId },
      data: { status: "DRAFT" },
    });
  }

  await logAudit({
    action: "UPDATE",
    resource: "ApprovalRequest",
    resourceId: ar.id,
    userId: session.user.id,
    tenantId: ar.tenantId,
    changes: { before: { status: "PENDING" }, after: { status: "REJECTED", notes } },
    req,
  });

  return NextResponse.json({ success: true, status: "REJECTED" });
}
