import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import QRCode from "qrcode";

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
      role !== "SUPER_ADMIN" &&
      role !== "TRAINER"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { traineeId, trainingActionId, completedAt } = body || {};
    if (!traineeId || !trainingActionId) {
      return NextResponse.json(
        { error: "traineeId e trainingActionId obrigatórios" },
        { status: 400 }
      );
    }

    const action = await prisma.trainingAction.findUnique({
      where: { id: trainingActionId },
      include: { course: true, tenant: true, trainers: true },
    });
    if (!action) {
      return NextResponse.json({ error: "Ação não encontrada" }, { status: 404 });
    }
    if (action.tenantId !== session.user.tenantId && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Cross-tenant" }, { status: 403 });
    }
    if (role === "TRAINER") {
      const trainer = await prisma.trainer.findUnique({
        where: { userId: session.user.id },
      });
      const allowed =
        trainer && action.trainers.some((t) => t.trainerId === trainer.id);
      if (!allowed) {
        return NextResponse.json({ error: "Not assigned" }, { status: 403 });
      }
    }

    const trainee = await prisma.trainee.findUnique({
      where: { id: traineeId },
      include: { user: true },
    });
    if (!trainee) {
      return NextResponse.json({ error: "Formando não encontrado" }, { status: 404 });
    }

    const completedDate = completedAt ? new Date(completedAt) : (action.endDate ?? new Date());

    const certificate = await prisma.certificate.create({
      data: {
        traineeId: trainee.id,
        courseName: action.course.name,
        courseCode: action.course.code ?? null,
        durationHours: action.course.durationHours,
        completedAt: completedDate,
      },
    });

    // Dispatch notificação multi-canal (best-effort)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl.replace(/\/$/, "")}/verify/${certificate.verificationCode}`;
    let qrDataUrl: string | null = null;
    try {
      qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: "M", margin: 1, width: 240,
        color: { dark: "#0B2447", light: "#FFFFFF" },
      });
    } catch {}
    const pdfUrl = `${baseUrl.replace(/\/$/, "")}/api/pdf/${trainingActionId}/CERTIFICADO_CONCLUSAO?traineeId=${trainee.id}`;

    sendNotification({
      event: "CERTIFICATE_ISSUED",
      traineeId: trainee.id,
      tenantId: action.tenantId,
      data: {
        cursoNome: action.course.name,
        dataConclusao: fmtDate(completedDate),
        certificateId: certificate.id,
        pdfUrl,
        verificationCode: certificate.verificationCode || "",
        qrDataUrl,
      },
    }).catch((e) => console.error("[certificates] notify error:", e));

    return NextResponse.json({
      success: true,
      certificateId: certificate.id,
      verificationCode: certificate.verificationCode,
    });
  } catch (e: any) {
    console.error("Certificate issue error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
