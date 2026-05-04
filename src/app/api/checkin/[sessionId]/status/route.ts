import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TRAINER" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const trainer = await prisma.trainer.findUnique({
    where: { userId: session.user.id },
  });

  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: params.sessionId },
    include: {
      trainingAction: {
        include: {
          trainers: true,
          enrollments: {
            where: { status: "CONFIRMED" },
            include: {
              trainee: { include: { clientOrg: true } },
            },
          },
        },
      },
      checkIns: true,
    },
  });

  if (!trainingSession) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  const isAssigned =
    trainer &&
    (trainingSession.trainerId === trainer.id ||
      trainingSession.trainingAction.trainers.some((t) => t.trainerId === trainer.id));
  if (!isAssigned && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not assigned to this session" }, { status: 403 });
  }

  const checkInByTrainee = new Map(
    trainingSession.checkIns.map((c) => [c.traineeId, c])
  );

  const trainees = trainingSession.trainingAction.enrollments.map((e) => {
    const ci = checkInByTrainee.get(e.traineeId);
    return {
      id: e.traineeId,
      name: `${e.trainee.firstName} ${e.trainee.lastName}`.trim(),
      company: e.trainee.clientOrg?.name || null,
      status: ci ? ci.status : "ABSENT",
      checkedInAt: ci?.checkedInAt?.toISOString() || null,
      isManual: ci?.isManual ?? false,
    };
  });

  const total = trainees.length;
  const present = trainees.filter((t) => t.status === "CHECKED_IN" || t.status === "MANUAL" || t.status === "CHECKED_OUT").length;
  const absent = total - present;

  return NextResponse.json({
    sessionId: trainingSession.id,
    isOpen: trainingSession.isOpen,
    isClosed: trainingSession.isClosed,
    total,
    present,
    absent,
    trainees,
  });
}
