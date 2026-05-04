import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

async function authorize(actionId: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { ok: false as const, error: "Unauthorized", status: 401 as const };
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return { ok: false as const, error: "Forbidden", status: 403 as const };
  }
  const action = await prisma.trainingAction.findUnique({ where: { id: actionId } });
  if (!action) return { ok: false as const, error: "Not found", status: 404 as const };
  if (action.tenantId !== session.user.tenantId && session.user.role !== "SUPER_ADMIN") {
    return { ok: false as const, error: "Cross-tenant", status: 403 as const };
  }
  return { ok: true, session, action } as const;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(params.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json();
  if (!body.description || body.amount == null || !body.category) {
    return NextResponse.json({ error: "description, category e amount obrigatórios" }, { status: 400 });
  }
  const cost = await prisma.trainingCost.create({
    data: {
      trainingActionId: auth.action.id,
      tenantId: auth.action.tenantId,
      description: String(body.description),
      category: String(body.category),
      amount: Number(body.amount),
      date: body.date ? new Date(body.date) : new Date(),
      invoiceRef: body.invoiceRef || null,
    },
  });
  // Atualizar Budget.spentAmount
  const total = await prisma.trainingCost.aggregate({
    where: { trainingActionId: auth.action.id },
    _sum: { amount: true },
  });
  await prisma.budget.upsert({
    where: { trainingActionId: auth.action.id },
    update: { spentAmount: total._sum.amount || 0 },
    create: {
      tenantId: auth.action.tenantId,
      trainingActionId: auth.action.id,
      budgetedAmount: 0,
      spentAmount: total._sum.amount || 0,
    },
  });
  await logAudit({
    action: "CREATE", resource: "TrainingCost", resourceId: cost.id,
    userId: auth.session.user.id, tenantId: auth.action.tenantId,
    changes: { after: { description: cost.description, amount: cost.amount } }, req,
  });
  return NextResponse.json({ success: true, costId: cost.id });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(params.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json();
  // Atualizar orçamento
  const before = await prisma.budget.findUnique({ where: { trainingActionId: auth.action.id } });
  const total = await prisma.trainingCost.aggregate({
    where: { trainingActionId: auth.action.id },
    _sum: { amount: true },
  });
  const updated = await prisma.budget.upsert({
    where: { trainingActionId: auth.action.id },
    update: { budgetedAmount: Number(body.budgetedAmount || 0), spentAmount: total._sum.amount || 0 },
    create: {
      tenantId: auth.action.tenantId,
      trainingActionId: auth.action.id,
      budgetedAmount: Number(body.budgetedAmount || 0),
      spentAmount: total._sum.amount || 0,
    },
  });
  await logAudit({
    action: "UPDATE", resource: "Budget", resourceId: updated.id,
    userId: auth.session.user.id, tenantId: auth.action.tenantId,
    changes: { before: { budgetedAmount: before?.budgetedAmount }, after: { budgetedAmount: updated.budgetedAmount } }, req,
  });
  return NextResponse.json({ success: true, budget: updated });
}
