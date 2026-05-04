import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { CostsClient } from "./CostsClient";

export default async function ActionCostsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/admin/dashboard");
  }
  const action = await prisma.trainingAction.findUnique({
    where: { id: params.id },
    include: { course: true, clientOrg: true },
  });
  if (!action || action.tenantId !== session.user.tenantId) notFound();

  const [budget, costs] = await Promise.all([
    prisma.budget.findUnique({ where: { trainingActionId: action.id } }),
    prisma.trainingCost.findMany({
      where: { trainingActionId: action.id },
      orderBy: { date: "desc" },
    }),
  ]);

  return (
    <CostsClient
      actionId={action.id}
      actionName={action.course.name}
      actionCode={action.actionCode || action.id.slice(0, 8)}
      clientName={action.clientOrg?.name || null}
      initialBudget={budget?.budgetedAmount || 0}
      initialSpent={budget?.spentAmount || 0}
      initialCosts={costs.map((c) => ({
        id: c.id,
        description: c.description,
        category: c.category,
        amount: c.amount,
        date: c.date.toISOString().slice(0, 10),
        invoiceRef: c.invoiceRef,
      }))}
    />
  );
}
