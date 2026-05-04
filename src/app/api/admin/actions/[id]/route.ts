import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session) return { ok: false as const, error: "Unauthorized", status: 401 as const };
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return { ok: false as const, error: "Forbidden", status: 403 as const };
  }
  return { ok: true, session } as const;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorize();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json();

  const existing = await prisma.trainingAction.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (existing.tenantId !== auth.session.user.tenantId && auth.session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cross-tenant" }, { status: 403 });
  }

  try {
    const updated = await prisma.trainingAction.update({
      where: { id: params.id },
      data: {
        courseId: body.courseId ?? existing.courseId,
        clientOrgId: body.clientOrgId ?? existing.clientOrgId,
        planId: body.planId ?? existing.planId,
        startDate: body.startDate ? new Date(body.startDate) : existing.startDate,
        endDate: body.endDate ? new Date(body.endDate) : existing.endDate,
        format: body.format ?? existing.format,
        roomId: body.roomId ?? existing.roomId,
        actionCode: body.actionCode ?? existing.actionCode,
        financingSystem: body.financingSystem ?? existing.financingSystem,
        maxTrainees: body.maxTrainees != null ? Number(body.maxTrainees) : existing.maxTrainees,
        minTrainees: body.minTrainees != null ? Number(body.minTrainees) : existing.minTrainees,
        status: body.status ?? existing.status,
      },
    });
    return NextResponse.json({ success: true, actionId: updated.id });
  } catch (e: any) {
    console.error("PUT /admin/actions error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
