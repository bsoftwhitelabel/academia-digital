import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const action = await prisma.trainingAction.findUnique({ where: { id: params.id } });
  if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (action.tenantId !== session.user.tenantId && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const responses = await prisma.questionnaireResponse.findMany({
    where: { trainingActionId: params.id },
    include: {
      questionnaire: { select: { name: true } },
      _count: { select: { answers: true } },
    },
    orderBy: { respondedAt: "desc" },
  });

  // Schema tem respondedAt @default(now()) — submissão real = ter answers.
  const total = responses.length;
  const responded = responses.filter((r) => r._count.answers > 0).length;
  return NextResponse.json({
    total,
    responded,
    pending: total - responded,
    responses: responses.map((r) => ({
      id: r.id,
      questionnaire: r.questionnaire.name,
      traineeId: r.traineeId,
      respondedAt: r._count.answers > 0 ? (r.respondedAt?.toISOString() ?? null) : null,
    })),
  });
}
