import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const trainingSession = await prisma.trainingSession.findUnique({
      where: { id: params.sessionId },
      include: { trainingAction: { include: { trainers: true } } },
    });
    if (!trainingSession) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }

    const isAssigned =
      trainer &&
      (trainingSession.trainerId === trainer.id ||
        trainingSession.trainingAction.trainers.some((t) => t.trainerId === trainer.id));
    if (!isAssigned && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 });
    }

    if (trainingSession.isClosed) {
      return NextResponse.json(
        { error: "Sessão já está encerrada" },
        { status: 400 }
      );
    }

    const now = new Date();
    const updated = await prisma.trainingSession.update({
      where: { id: trainingSession.id },
      data: {
        isOpen: false,
        isClosed: true,
        closedAt: now,
        closedById: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: updated.id,
      closedAt: updated.closedAt,
    });
  } catch (error: any) {
    console.error("Close session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
