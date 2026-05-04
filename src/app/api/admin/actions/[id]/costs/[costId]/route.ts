import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; costId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cost = await prisma.trainingCost.findUnique({ where: { id: params.costId } });
  if (!cost) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (cost.tenantId !== session.user.tenantId && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cross-tenant" }, { status: 403 });
  }
  if (cost.trainingActionId !== params.id) {
    return NextResponse.json({ error: "Mismatch action/cost" }, { status: 400 });
  }
  await prisma.trainingCost.delete({ where: { id: cost.id } });
  // Recalcular Budget.spentAmount
  const total = await prisma.trainingCost.aggregate({
    where: { trainingActionId: cost.trainingActionId },
    _sum: { amount: true },
  });
  await prisma.budget.upsert({
    where: { trainingActionId: cost.trainingActionId },
    update: { spentAmount: total._sum.amount || 0 },
    create: {
      tenantId: cost.tenantId,
      trainingActionId: cost.trainingActionId,
      budgetedAmount: 0,
      spentAmount: total._sum.amount || 0,
    },
  });
  await logAudit({
    action: "DELETE", resource: "TrainingCost", resourceId: cost.id,
    userId: session.user.id, tenantId: cost.tenantId, req,
  });
  return NextResponse.json({ success: true });
}
