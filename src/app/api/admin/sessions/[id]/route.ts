import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ts = await prisma.trainingSession.findUnique({
    where: { id: params.id },
    include: { trainingAction: { include: { course: true, room: true } } },
  });
  if (!ts || ts.trainingAction.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: any = {};
  if (body.sessionDate) data.sessionDate = new Date(body.sessionDate);
  if (body.startTime) data.startTime = body.startTime;
  if (body.endTime) data.endTime = body.endTime;
  if (body.durationHours != null) data.durationHours = body.durationHours;
  if (body.trainerId) data.trainerId = body.trainerId;

  const updated = await prisma.trainingSession.update({ where: { id: ts.id }, data });

  if (ts.googleEventId) {
    await updateCalendarEvent(ts.trainingAction.tenantId, ts.googleEventId, {
      courseName: ts.trainingAction.course.name,
      sessionDate: updated.sessionDate,
      startTime: updated.startTime,
      endTime: updated.endTime,
      location: ts.trainingAction.room?.name || (ts.trainingAction.format === "ELEARNING" ? "E-learning" : null),
      description: `Ação: ${ts.trainingAction.actionCode || ts.trainingAction.id.slice(0, 8)}`,
    });
  }

  await logAudit({
    action: "UPDATE",
    resource: "TrainingSession",
    resourceId: ts.id,
    userId: session.user.id,
    tenantId: ts.trainingAction.tenantId,
    changes: { before: { sessionDate: ts.sessionDate, startTime: ts.startTime, endTime: ts.endTime }, after: data },
    req,
  });

  return NextResponse.json({ success: true, session: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ts = await prisma.trainingSession.findUnique({
    where: { id: params.id },
    include: { trainingAction: true },
  });
  if (!ts || ts.trainingAction.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (ts.googleEventId) {
    await deleteCalendarEvent(ts.trainingAction.tenantId, ts.googleEventId);
  }

  await prisma.trainingSession.delete({ where: { id: ts.id } });

  await logAudit({
    action: "DELETE",
    resource: "TrainingSession",
    resourceId: ts.id,
    userId: session.user.id,
    tenantId: ts.trainingAction.tenantId,
    changes: { before: { sessionDate: ts.sessionDate } },
    req,
  });

  return NextResponse.json({ success: true });
}
