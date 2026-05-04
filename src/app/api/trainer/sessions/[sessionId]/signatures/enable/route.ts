import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function authorizeTrainer(sessionId: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized", status: 401 as const };
  if (session.user.role !== "TRAINER" && session.user.role !== "SUPER_ADMIN") {
    return { error: "Forbidden", status: 403 as const };
  }
  const trainer = await prisma.trainer.findUnique({
    where: { userId: session.user.id },
  });
  const ts = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: { trainingAction: { include: { trainers: true } } },
  });
  if (!ts) return { error: "Sessão não encontrada", status: 404 as const };
  const isAssigned =
    trainer &&
    (ts.trainerId === trainer.id ||
      ts.trainingAction.trainers.some((t) => t.trainerId === trainer.id));
  if (!isAssigned && session.user.role !== "SUPER_ADMIN") {
    return { error: "Not assigned", status: 403 as const };
  }
  return { ok: true, session, trainingSession: ts } as const;
}

const ATTENDANCE_DOC_TYPE = "REGISTO_PRESENCAS";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const auth = await authorizeTrainer(params.sessionId);
  if (!("ok" in auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Buscar formandos com check-in (qualquer status != ABSENT, i.e. CheckIn existe)
  const checkIns = await prisma.checkIn.findMany({
    where: {
      sessionId: params.sessionId,
      status: { in: ["CHECKED_IN", "CHECKED_OUT", "MANUAL"] },
    },
    include: {
      trainee: { include: { clientOrg: true } },
    },
  });

  const traineeIds = checkIns.map((c) => c.traineeId);
  const signatures = await prisma.documentSignature.findMany({
    where: {
      sessionId: params.sessionId,
      traineeId: { in: traineeIds },
      documentType: ATTENDANCE_DOC_TYPE,
    },
  });
  const sigByTrainee = new Map(signatures.map((s) => [s.traineeId!, s]));

  const trainees = checkIns.map((c) => {
    const sig = sigByTrainee.get(c.traineeId);
    return {
      id: c.traineeId,
      name: `${c.trainee.firstName} ${c.trainee.lastName}`.trim(),
      company: c.trainee.clientOrg?.name || null,
      checkInStatus: c.status,
      signatureStatus: sig?.status || null,
      signatureId: sig?.id || null,
    };
  });

  return NextResponse.json({
    sessionId: auth.trainingSession.id,
    isClosed: auth.trainingSession.isClosed,
    trainees,
  });
}

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const auth = await authorizeTrainer(params.sessionId);
    if (!("ok" in auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const traineeIds: string[] = Array.isArray(body.traineeIds) ? body.traineeIds : [];
    const reason: string | undefined = body.reason?.trim() || undefined;

    if (traineeIds.length === 0) {
      return NextResponse.json(
        { error: "Selecione pelo menos um formando" },
        { status: 400 }
      );
    }

    if (auth.trainingSession.isClosed && !reason) {
      return NextResponse.json(
        { error: "Justificação obrigatória para sessão encerrada" },
        { status: 400 }
      );
    }

    const now = new Date();
    const enablerId = auth.session.user.id;

    // Confirmar que cada traineeId tem check-in nesta sessão
    const validCheckIns = await prisma.checkIn.findMany({
      where: { sessionId: params.sessionId, traineeId: { in: traineeIds } },
      include: { trainee: { include: { user: true } } },
    });

    const validIds = new Set(validCheckIns.map((c) => c.traineeId));
    const accepted: string[] = [];
    const skipped: string[] = [];

    for (const tid of traineeIds) {
      if (!validIds.has(tid)) {
        skipped.push(tid);
        continue;
      }
      const existing = await prisma.documentSignature.findFirst({
        where: {
          sessionId: params.sessionId,
          traineeId: tid,
          documentType: ATTENDANCE_DOC_TYPE,
        },
      });
      if (existing) {
        // Não rebaixar de SIGNED para ENABLED
        if (existing.status === "SIGNED") {
          skipped.push(tid);
          continue;
        }
        await prisma.documentSignature.update({
          where: { id: existing.id },
          data: {
            status: "ENABLED",
            enabledAt: now,
            enabledById: enablerId,
            enabledNotes: reason,
          },
        });
      } else {
        await prisma.documentSignature.create({
          data: {
            sessionId: params.sessionId,
            traineeId: tid,
            documentType: ATTENDANCE_DOC_TYPE,
            status: "ENABLED",
            enabledAt: now,
            enabledById: enablerId,
            enabledNotes: reason,
          },
        });
      }
      accepted.push(tid);
    }

    // Notificações multi-canal (best-effort, não bloqueia o response)
    if (accepted.length > 0) {
      const tenantId = auth.trainingSession.trainingAction.tenantId;
      for (const ci of validCheckIns) {
        if (!accepted.includes(ci.traineeId)) continue;
        const sig = await prisma.documentSignature.findFirst({
          where: {
            sessionId: params.sessionId,
            traineeId: ci.traineeId,
            documentType: ATTENDANCE_DOC_TYPE,
          },
        });
        if (!sig) continue;
        sendNotification({
          event: "SIGNATURE_ENABLED",
          traineeId: ci.traineeId,
          tenantId,
          data: {
            cursoNome: "Registo de Presenças",
            sessaoData: fmtDate(auth.trainingSession.sessionDate),
            documentId: sig.id,
            expiresAt: auth.trainingSession.checkinCloseAt
              ? fmtDate(auth.trainingSession.checkinCloseAt)
              : null,
            notes: reason || null,
          },
        }).catch((e) => console.error("[enable] notify error:", e));
      }
    }

    return NextResponse.json({
      success: true,
      enabled: accepted.length,
      acceptedIds: accepted,
      skippedIds: skipped,
    });
  } catch (error: any) {
    console.error("Enable signatures error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
