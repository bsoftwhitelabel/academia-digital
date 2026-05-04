import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/admin/dashboard");
  }

  const tenantId = session.user.tenantId;
  const [courses, trainers, clientOrgs] = await Promise.all([
    prisma.course.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.trainer.findMany({
      where: { tenantId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: [{ user: { firstName: "asc" } }],
    }),
    prisma.clientOrg.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <ReportsClient
      courses={courses}
      trainers={trainers.map((t) => ({
        id: t.id,
        name: `${t.user?.firstName || ""} ${t.user?.lastName || ""}`.trim(),
      }))}
      clientOrgs={clientOrgs}
    />
  );
}
