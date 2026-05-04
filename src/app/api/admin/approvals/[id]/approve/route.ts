import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";

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
  const notes = (body.notes || "").trim() || null;

  const now = new Date();
  await prisma.approvalRequest.update({
    where: { id: ar.id },
    data: {
      status: "APPROVED",
      reviewedById: session.user.id,
      reviewedAt: now,
      reviewNotes: notes,
    },
  });

  // Aplicar a aprovação ao recurso
  if (ar.type === "ENROLLMENT") {
    const enrollment = await prisma.enrollment.update({
      where: { id: ar.resourceId },
      data: { status: "CONFIRMED" },
      include: {
        trainingAction: { include: { course: true, room: true } },
      },
    });
    // Notificar o formando agora que está confirmada
    const fmtDate = (d: Date | null) => {
      if (!d) return "—";
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}/${d.getUTCFullYear()}`;
    };
    sendNotification({
      event: "ENROLLMENT_CONFIRMED",
      traineeId: enrollment.traineeId,
      tenantId: ar.tenantId,
      data: {
        cursoNome: enrollment.trainingAction.course.name,
        dataInicio: fmtDate(enrollment.trainingAction.startDate),
        dataFim: fmtDate(enrollment.trainingAction.endDate),
        local:
          enrollment.trainingAction.room?.name ||
          (enrollment.trainingAction.format === "ELEARNING" ? "E-learning" : "Local a confirmar"),
      },
    }).catch((e) => console.error("[approve] notify error:", e));
  } else if (ar.type === "TRAINING_PLAN") {
    await prisma.trainingPlan.update({
      where: { id: ar.resourceId },
      data: { status: "APPROVED" },
    });
  }

  await logAudit({
    action: "UPDATE",
    resource: "ApprovalRequest",
    resourceId: ar.id,
    userId: session.user.id,
    tenantId: ar.tenantId,
    changes: { before: { status: "PENDING" }, after: { status: "APPROVED", notes } },
    req,
  });

  return NextResponse.json({ success: true, status: "APPROVED" });
}
