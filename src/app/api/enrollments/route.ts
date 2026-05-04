import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role;
    if (
      role !== "TENANT_ADMIN" &&
      role !== "TENANT_STAFF" &&
      role !== "TRAINER" &&
      role !== "SUPER_ADMIN" &&
      role !== "CLIENT_HR"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { trainingActionId, traineeId } = body || {};
    if (!trainingActionId || !traineeId) {
      return NextResponse.json(
        { error: "trainingActionId e traineeId obrigatórios" },
        { status: 400 }
      );
    }

    const action = await prisma.trainingAction.findUnique({
      where: { id: trainingActionId },
      include: {
        course: true,
        room: true,
        trainers: true,
      },
    });
    if (!action) {
      return NextResponse.json({ error: "Ação não encontrada" }, { status: 404 });
    }
    // Tenant scope check
    if (action.tenantId !== session.user.tenantId && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Cross-tenant forbidden" }, { status: 403 });
    }
    const trainee = await prisma.trainee.findUnique({
      where: { id: traineeId },
      include: { user: true },
    });
    if (!trainee) {
      return NextResponse.json({ error: "Formando não encontrado" }, { status: 404 });
    }
    if (trainee.tenantId !== action.tenantId) {
      return NextResponse.json({ error: "Trainee de outro tenant" }, { status: 400 });
    }

    // Verificar se o tenant exige aprovação
    const tenant = await prisma.tenant.findUnique({
      where: { id: action.tenantId },
      select: { requireEnrollmentApproval: true },
    });
    const requiresApproval = !!tenant?.requireEnrollmentApproval;

    const enrollment = await prisma.enrollment.upsert({
      where: { trainingActionId_traineeId: { trainingActionId, traineeId } },
      update: { status: requiresApproval ? "PENDING_APPROVAL" : "CONFIRMED" },
      create: { trainingActionId, traineeId, status: requiresApproval ? "PENDING_APPROVAL" : "CONFIRMED" },
    });

    if (requiresApproval) {
      await prisma.approvalRequest.create({
        data: {
          tenantId: action.tenantId,
          type: "ENROLLMENT",
          resourceId: enrollment.id,
          resourceType: "Enrollment",
          requestedById: session.user.id,
          status: "PENDING",
          metadata: {
            trainingActionId,
            traineeId,
            courseName: action.course.name,
            traineeName: `${trainee.firstName} ${trainee.lastName}`.trim(),
          },
        },
      });

      await logAudit({
        action: "CREATE",
        resource: "ApprovalRequest",
        resourceId: enrollment.id,
        userId: session.user.id,
        tenantId: action.tenantId,
        changes: { after: { type: "ENROLLMENT", status: "PENDING" } },
        req,
      });

      return NextResponse.json({
        success: true,
        status: "pending",
        enrollmentId: enrollment.id,
        message: "Inscrição aguarda aprovação.",
      });
    }

    await logAudit({
      action: "CREATE",
      resource: "Enrollment",
      resourceId: enrollment.id,
      userId: session.user.id,
      tenantId: action.tenantId,
      changes: { after: { trainingActionId, traineeId, status: "CONFIRMED" } },
      req,
    });

    const local =
      action.room?.name ||
      (action.format === "ELEARNING" ? "E-learning" : "Local a confirmar");

    // Disparar notificação (email + WhatsApp se configurado) — best-effort
    sendNotification({
      event: "ENROLLMENT_CONFIRMED",
      traineeId,
      tenantId: action.tenantId,
      data: {
        cursoNome: action.course.name,
        dataInicio: fmtDate(action.startDate),
        dataFim: fmtDate(action.endDate),
        local,
      },
    }).catch((e) => console.error("[enrollments] notify error:", e));

    return NextResponse.json({
      success: true,
      enrollmentId: enrollment.id,
      status: enrollment.status,
    });
  } catch (e: any) {
    console.error("Enrollment error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
