import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function authorize(sessionId: string) {
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

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const auth = await authorize(params.sessionId);
    if (!("ok" in auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { traineeId, notes } = await req.json();
    if (!traineeId) {
      return NextResponse.json({ error: "traineeId em falta" }, { status: 400 });
    }

    // Verificar se o formando está inscrito na ação
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        trainingActionId_traineeId: {
          trainingActionId: auth.trainingSession.trainingActionId,
          traineeId,
        },
      },
    });
    if (!enrollment) {
      return NextResponse.json(
        { error: "Formando não está inscrito nesta ação" },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const checkin = await prisma.checkIn.upsert({
      where: {
        sessionId_traineeId: {
          sessionId: params.sessionId,
          traineeId,
        },
      },
      update: {
        status: "MANUAL",
        isManual: true,
        manualNotes: notes ?? null,
        registeredById: auth.session.user.id,
        checkedInAt: new Date(),
        ipAddress,
        userAgent,
      },
      create: {
        sessionId: params.sessionId,
        traineeId,
        status: "MANUAL",
        isManual: true,
        manualNotes: notes ?? null,
        registeredById: auth.session.user.id,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({ success: true, checkInId: checkin.id });
  } catch (error: any) {
    console.error("Manual check-in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const auth = await authorize(params.sessionId);
    if (!("ok" in auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const traineeId = url.searchParams.get("traineeId");
    if (!traineeId) {
      return NextResponse.json({ error: "traineeId em falta" }, { status: 400 });
    }

    await prisma.checkIn.delete({
      where: {
        sessionId_traineeId: {
          sessionId: params.sessionId,
          traineeId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Check-in não encontrado" }, { status: 404 });
    }
    console.error("Delete check-in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
