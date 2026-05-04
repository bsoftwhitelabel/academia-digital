import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ActionForm } from "../../ActionForm";

function toIsoDate(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

export default async function EditActionPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const tenantId = session.user.tenantId;
  const [action, courses, clients, rooms, plans] = await Promise.all([
    prisma.trainingAction.findUnique({ where: { id: params.id } }),
    prisma.course.findMany({ where: { tenantId } }),
    prisma.clientOrg.findMany({ where: { tenantId } }),
    prisma.room.findMany({ where: { tenantId } }),
    prisma.trainingPlan.findMany({ where: { tenantId } }),
  ]);
  if (!action || action.tenantId !== tenantId) notFound();

  return (
    <ActionForm
      isNew={false}
      initial={{
        id: action.id,
        courseId: action.courseId,
        clientOrgId: action.clientOrgId,
        planId: action.planId,
        startDate: toIsoDate(action.startDate),
        endDate: toIsoDate(action.endDate),
        format: action.format,
        roomId: action.roomId,
        actionCode: action.actionCode || "",
        financingSystem: action.financingSystem,
        maxTrainees: action.maxTrainees,
        status: action.status,
      }}
      courses={courses.map((c) => ({ id: c.id, label: c.name }))}
      clients={clients.map((c) => ({ id: c.id, label: c.name }))}
      rooms={rooms.map((r) => ({ id: r.id, label: r.name }))}
      plans={plans.map((p) => ({ id: p.id, label: p.name }))}
    />
  );
}
