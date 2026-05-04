import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

function combineDateAndTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const out = new Date(date);
  out.setHours(isNaN(h) ? 23 : h, isNaN(m) ? 59 : m, 0, 0);
  return out;
}

export async function POST(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "TRAINER" && session.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { userId: session.user.id },
    });
    if (!trainer && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Trainer profile not found" }, { status: 404 });
    }

    const trainingSession = await prisma.trainingSession.findUnique({
      where: { id: params.sessionId },
      include: {
        trainingAction: {
          include: { trainers: true },
        },
      },
    });

    if (!trainingSession) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }

    // Autorização: o formador é o trainer da sessão OU está ligado à action
    const isAssigned =
      trainer &&
      (trainingSession.trainerId === trainer.id ||
        trainingSession.trainingAction.trainers.some((t) => t.trainerId === trainer.id));

    if (!isAssigned && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Not assigned to this session" }, { status: 403 });
    }

    if (trainingSession.isClosed) {
      return NextResponse.json(
        { error: "Sessão já foi encerrada" },
        { status: 400 }
      );
    }

    const now = new Date();
    const checkinCloseAt = combineDateAndTime(
      trainingSession.sessionDate,
      trainingSession.endTime
    );

    const updated = await prisma.trainingSession.update({
      where: { id: trainingSession.id },
      data: {
        isOpen: true,
        checkinOpenAt: now,
        checkinCloseAt,
      },
    });

    // Garantir estado "IN_PROGRESS" da action (só se ainda DRAFT/SCHEDULED)
    if (
      trainingSession.trainingAction.status === "DRAFT" ||
      trainingSession.trainingAction.status === "SCHEDULED"
    ) {
      await prisma.trainingAction.update({
        where: { id: trainingSession.trainingActionId },
        data: { status: "IN_PROGRESS" },
      });
    }

    return NextResponse.json({
      success: true,
      sessionId: updated.id,
      isOpen: updated.isOpen,
      checkinOpenAt: updated.checkinOpenAt,
      checkinCloseAt: updated.checkinCloseAt,
    });
  } catch (error: any) {
    console.error("Open session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
