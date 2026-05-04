import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ session: null }, { status: 401 });
  const role = session.user.role;
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ session: null }, { status: 403 });
  }
  const ts = await prisma.trainingSession.findFirst({
    where: {
      isOpen: true,
      trainingAction: { tenantId: session.user.tenantId },
    },
    include: {
      trainer: { include: { user: true } },
      trainingAction: {
        include: {
          course: true,
          enrollments: { where: { status: "CONFIRMED" } },
        },
      },
      checkIns: true,
    },
    orderBy: { sessionDate: "desc" },
  });
  if (!ts) return NextResponse.json({ session: null });
  return NextResponse.json({
    session: {
      sessionId: ts.id,
      courseName: ts.trainingAction.course.name,
      trainerName: `${ts.trainer.user.firstName} ${ts.trainer.user.lastName}`.trim(),
      present: ts.checkIns.filter((c) => c.status !== "ABSENT").length,
      total: ts.trainingAction.enrollments.length,
    },
  });
}
