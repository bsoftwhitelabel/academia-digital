import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "TRAINEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trainee = await prisma.trainee.findUnique({
      where: { userId: session.user.id },
    });

    if (!trainee) {
      return NextResponse.json({ error: "Trainee not found" }, { status: 404 });
    }

    const trainingSession = await prisma.trainingSession.findUnique({
      where: { id: params.sessionId },
    });

    if (!trainingSession || !trainingSession.isOpen) {
      return NextResponse.json(
        { error: "Sessão não existe ou está fechada" },
        { status: 400 }
      );
    }

    // Verificar se já fez check-in
    const existingCheckIn = await prisma.checkIn.findUnique({
      where: {
        sessionId_traineeId: {
          sessionId: params.sessionId,
          traineeId: trainee.id,
        },
      },
    });

    if (existingCheckIn) {
      return NextResponse.json(
        { error: "Check-in já realizado" },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const checkin = await prisma.checkIn.create({
      data: {
        sessionId: params.sessionId,
        traineeId: trainee.id,
        status: "CHECKED_IN",
        checkedInAt: new Date(),
        ipAddress,
        userAgent,
        isManual: false,
      },
    });

    await logAudit({
      action: "CREATE",
      resource: "CheckIn",
      resourceId: checkin.id,
      userId: session.user.id,
      tenantId: trainee.tenantId,
      changes: { after: { sessionId: params.sessionId, traineeId: trainee.id, status: "CHECKED_IN" } },
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Check-in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
