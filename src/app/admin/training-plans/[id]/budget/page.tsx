import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { PlanBudgetClient } from "./PlanBudgetClient";

export default async function PlanBudgetPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/admin/dashboard");
  }
  const plan = await prisma.trainingPlan.findUnique({ where: { id: params.id } });
  if (!plan || plan.tenantId !== session.user.tenantId) notFound();

  // Carregar ações + budgets + custos por mês
  const actions = await prisma.trainingAction.findMany({
    where: { planId: plan.id, tenantId: session.user.tenantId },
    include: { course: true },
  });
  const actionIds = actions.map((a) => a.id);
  const [budgets, allCosts] = await Promise.all([
    prisma.budget.findMany({ where: { trainingActionId: { in: actionIds } } }),
    prisma.trainingCost.findMany({ where: { trainingActionId: { in: actionIds } } }),
  ]);

  // Agregar por mês
  const byMonth: Record<string, { month: string; budgeted: number; spent: number }> = {};
  // Tomar 12 meses do ano do plano
  const year = plan.year || new Date().getUTCFullYear();
  for (let i = 0; i < 12; i++) {
    const m = String(i + 1).padStart(2, "0");
    const key = `${year}-${m}`;
    byMonth[key] = { month: key, budgeted: 0, spent: 0 };
  }
  // Distribuir orçamento da plano por meses (linear) só se Budget vinculado ao plano existe
  const planBudget = await prisma.budget.findUnique({ where: { trainingPlanId: plan.id } });
  const totalBudget = planBudget?.budgetedAmount || actions.reduce((s, a) => {
    const b = budgets.find((bb) => bb.trainingActionId === a.id);
    return s + (b?.budgetedAmount || 0);
  }, 0);
  // Spent por mês a partir de allCosts
  for (const c of allCosts) {
    const k = `${c.date.getUTCFullYear()}-${String(c.date.getUTCMonth() + 1).padStart(2, "0")}`;
    if (byMonth[k]) byMonth[k].spent += c.amount;
  }
  // Distribuir orçamento linearmente
  const perMonth = totalBudget / 12;
  for (const k of Object.keys(byMonth)) byMonth[k].budgeted = perMonth;

  const totalSpent = allCosts.reduce((s, c) => s + c.amount, 0);

  return (
    <PlanBudgetClient
      planId={plan.id}
      planName={plan.name}
      planYear={year}
      totalBudget={totalBudget}
      totalSpent={totalSpent}
      monthly={Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))}
      actions={actions.map((a) => {
        const b = budgets.find((bb) => bb.trainingActionId === a.id);
        const sp = allCosts.filter((c) => c.trainingActionId === a.id).reduce((s, c) => s + c.amount, 0);
        return {
          id: a.id,
          name: a.course.name,
          code: a.actionCode || a.id.slice(0, 8),
          budgeted: b?.budgetedAmount || 0,
          spent: sp,
        };
      })}
    />
  );
}
