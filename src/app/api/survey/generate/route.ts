import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import QRCode from "qrcode";
import { sendNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["TENANT_ADMIN", "TENANT_STAFF", "TRAINER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { trainingActionId, questionnaireId, traineeId, mode } = body || {};
    if (!trainingActionId || !questionnaireId) {
      return NextResponse.json({ error: "trainingActionId e questionnaireId obrigatórios" }, { status: 400 });
    }

    const action = await prisma.trainingAction.findUnique({
      where: { id: trainingActionId },
      include: {
        trainers: true,
        enrollments: { where: { status: { in: ["CONFIRMED", "COMPLETED"] } } },
      },
    });
    if (!action) return NextResponse.json({ error: "Ação não encontrada" }, { status: 404 });
    if (action.tenantId !== session.user.tenantId && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Cross-tenant" }, { status: 403 });
    }

    if (session.user.role === "TRAINER") {
      const trainer = await prisma.trainer.findUnique({ where: { userId: session.user.id } });
      const isAssigned = !!trainer && action.trainers.some((t) => t.trainerId === trainer.id);
      if (!isAssigned) return NextResponse.json({ error: "Not assigned" }, { status: 403 });
    }

    const questionnaire = await prisma.questionnaire.findUnique({ where: { id: questionnaireId } });
    if (!questionnaire) return NextResponse.json({ error: "Questionário não encontrado" }, { status: 404 });
    if (questionnaire.tenantId !== action.tenantId) {
      return NextResponse.json({ error: "Cross-tenant" }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Modo "shared" (mode=shared) → 1 só Response para projetar (sem traineeId)
    // Modo "per-trainee" (default) → 1 Response por formando inscrito
    const created: Array<{ token: string; url: string; traineeId: string | null }> = [];

    if (mode === "shared" || traineeId === "SHARED") {
      const r = await prisma.questionnaireResponse.create({
        data: {
          questionnaireId,
          trainingActionId,
        },
      });
      const url = `${baseUrl.replace(/\/$/, "")}/survey/${r.token}`;
      created.push({ token: r.token, url, traineeId: null });
    } else if (traineeId) {
      // Verificar inscrição
      const enr = action.enrollments.find((e) => e.traineeId === traineeId);
      if (!enr) return NextResponse.json({ error: "Formando não inscrito" }, { status: 400 });
      const r = await prisma.questionnaireResponse.create({
        data: { questionnaireId, trainingActionId, traineeId },
      });
      const url = `${baseUrl.replace(/\/$/, "")}/survey/${r.token}`;
      created.push({ token: r.token, url, traineeId });
    } else {
      // Por formando inscrito
      for (const e of action.enrollments) {
        const r = await prisma.questionnaireResponse.create({
          data: { questionnaireId, trainingActionId, traineeId: e.traineeId },
        });
        const url = `${baseUrl.replace(/\/$/, "")}/survey/${r.token}`;
        created.push({ token: r.token, url, traineeId: e.traineeId });
      }
    }

    // Disparar notificação QUESTIONNAIRE_AVAILABLE para cada formando com link único
    // (apenas quando não é "shared" — i.e. quando há traineeId associado)
    for (const c of created) {
      if (!c.traineeId) continue;
      sendNotification({
        event: "QUESTIONNAIRE_AVAILABLE",
        traineeId: c.traineeId,
        tenantId: action.tenantId,
        data: {
          cursoNome: questionnaire.name,
          linkSurvey: c.url,
        },
      }).catch((e) => console.error("[survey/generate] notify error:", e));
    }

    // Gerar QR Code do primeiro (ou do único shared)
    const qrTarget = created[0]?.url;
    let qrCodeBase64: string | null = null;
    if (qrTarget) {
      try {
        qrCodeBase64 = await QRCode.toDataURL(qrTarget, {
          errorCorrectionLevel: "M", margin: 1, width: 480,
          color: { dark: "#0B2447", light: "#FFFFFF" },
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      total: created.length,
      url: qrTarget || null,
      qrCodeBase64,
      tokens: created.map((c) => ({ token: c.token, traineeId: c.traineeId })),
    });
  } catch (e: any) {
    console.error("Survey generate error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
