import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ApprovalsClient } from "./ApprovalsClient";

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/admin/dashboard");
  }
  const tenantId = session.user.tenantId;

  const requests = await prisma.approvalRequest.findMany({
    where: { tenantId, status: "PENDING" },
    orderBy: { requestedAt: "desc" },
  });

  // Carregar informação do requester
  const userIds = Array.from(new Set(requests.map((r) => r.requestedById)));
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <ApprovalsClient
      items={requests.map((r) => ({
        id: r.id,
        type: r.type,
        resourceId: r.resourceId,
        resourceType: r.resourceType,
        requestedAt: r.requestedAt.toISOString(),
        requestedBy: userMap[r.requestedById]
          ? `${userMap[r.requestedById].firstName} ${userMap[r.requestedById].lastName}`.trim()
          : r.requestedById.slice(0, 8),
        metadata: (r.metadata as any) || {},
      }))}
    />
  );
}
