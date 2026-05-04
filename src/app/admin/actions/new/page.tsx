import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ActionForm } from "../ActionForm";

export default async function NewActionPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const tenantId = session.user.tenantId;
  const [courses, clients, rooms, plans] = await Promise.all([
    prisma.course.findMany({ where: { tenantId, status: { in: ["PUBLISHED", "FEATURED"] } } }),
    prisma.clientOrg.findMany({ where: { tenantId } }),
    prisma.room.findMany({ where: { tenantId } }),
    prisma.trainingPlan.findMany({ where: { tenantId } }),
  ]);
  return (
    <ActionForm
      isNew
      initial={{
        courseId: "",
        startDate: "",
        endDate: "",
        format: "PRESENCIAL",
        status: "DRAFT",
      }}
      courses={courses.map((c) => ({ id: c.id, label: c.name }))}
      clients={clients.map((c) => ({ id: c.id, label: c.name }))}
      rooms={rooms.map((r) => ({ id: r.id, label: r.name }))}
      plans={plans.map((p) => ({ id: p.id, label: p.name }))}
    />
  );
}
