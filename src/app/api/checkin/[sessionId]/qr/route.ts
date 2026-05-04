import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { randomBytes } from "node:crypto";

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

    // Reutilizar token se ainda válido (não expirado)
    let token = trainingSession.checkinQrCode;
    let expiresAt = trainingSession.checkinQrExpiresAt;
    const stillValid = token && expiresAt && expiresAt > now;

    if (!stillValid) {
      token = randomBytes(24).toString("base64url");
      expiresAt =
        trainingSession.checkinCloseAt ??
        combineDateAndTime(trainingSession.sessionDate, trainingSession.endTime);

      await prisma.trainingSession.update({
        where: { id: trainingSession.id },
        data: { checkinQrCode: token, checkinQrExpiresAt: expiresAt },
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const url = `${baseUrl.replace(/\/$/, "")}/trainee/checkin/${trainingSession.id}?qr=${token}`;

    return NextResponse.json({
      sessionId: trainingSession.id,
      token,
      expiresAt: expiresAt!.toISOString(),
      url,
    });
  } catch (error: any) {
    console.error("QR generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
