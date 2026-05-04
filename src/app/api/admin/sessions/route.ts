import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createCalendarEvent } from "@/lib/google-calendar";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { trainingActionId, trainerId, sessionDate, startTime, endTime, durationHours } = body;
  if (!trainingActionId || !trainerId || !sessionDate || !startTime || !endTime || durationHours == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const action = await prisma.trainingAction.findUnique({
    where: { id: trainingActionId },
    include: { course: true, room: true },
  });
  if (!action || action.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  const created = await prisma.trainingSession.create({
    data: {
      trainingActionId,
      trainerId,
      sessionDate: new Date(sessionDate),
      startTime,
      endTime,
      durationHours,
    },
  });

  // Sync to Google Calendar
  const eventId = await createCalendarEvent(action.tenantId, {
    courseName: action.course.name,
    sessionDate: new Date(sessionDate),
    startTime,
    endTime,
    location: action.room?.name || (action.format === "ELEARNING" ? "E-learning" : null),
    description: `Ação: ${action.actionCode || action.id.slice(0, 8)}`,
  });
  if (eventId) {
    await prisma.trainingSession.update({
      where: { id: created.id },
      data: { googleEventId: eventId },
    });
  }

  await logAudit({
    action: "CREATE",
    resource: "TrainingSession",
    resourceId: created.id,
    userId: session.user.id,
    tenantId: action.tenantId,
    changes: { after: { sessionDate, startTime, endTime, googleEventId: eventId } },
    req,
  });

  return NextResponse.json({ success: true, session: created, googleEventId: eventId });
}
