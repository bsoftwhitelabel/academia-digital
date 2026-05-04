import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const plan = await prisma.trainingPlan.findUnique({ where: { id: params.id } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.tenantId !== session.user.tenantId && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cross-tenant" }, { status: 403 });
  }
  if (plan.status !== "DRAFT" && plan.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Plano em estado ${plan.status} não pode ser submetido` },
      { status: 400 }
    );
  }

  await prisma.trainingPlan.update({
    where: { id: plan.id },
    data: { status: "SUBMITTED" },
  });

  await prisma.approvalRequest.create({
    data: {
      tenantId: plan.tenantId,
      type: "TRAINING_PLAN",
      resourceId: plan.id,
      resourceType: "TrainingPlan",
      requestedById: session.user.id,
      status: "PENDING",
      metadata: {
        planName: plan.name,
        year: plan.year,
        budget: plan.budget,
      },
    },
  });

  await logAudit({
    action: "UPDATE",
    resource: "TrainingPlan",
    resourceId: plan.id,
    userId: session.user.id,
    tenantId: plan.tenantId,
    changes: { before: { status: plan.status }, after: { status: "SUBMITTED" } },
    req,
  });

  return NextResponse.json({ success: true, status: "SUBMITTED" });
}
