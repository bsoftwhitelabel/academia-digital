import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized", status: 401 as const };
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { ok: true, session } as const;
}

export async function POST(req: Request) {
  const auth = await authorize();
  if (!("ok" in auth)) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json();
  if (!body.courseId || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: "courseId, startDate e endDate obrigatórios" },
      { status: 400 }
    );
  }
  try {
    const created = await prisma.trainingAction.create({
      data: {
        tenantId: auth.session.user.tenantId,
        courseId: body.courseId,
        clientOrgId: body.clientOrgId ?? null,
        planId: body.planId ?? null,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        format: body.format ?? "PRESENCIAL",
        roomId: body.roomId ?? null,
        actionCode: body.actionCode ?? null,
        financingSystem: body.financingSystem ?? null,
        maxTrainees: body.maxTrainees ? Number(body.maxTrainees) : null,
        minTrainees: body.minTrainees ? Number(body.minTrainees) : null,
        status: body.status ?? "DRAFT",
      },
    });
    return NextResponse.json({ success: true, actionId: created.id });
  } catch (e: any) {
    console.error("POST /admin/actions error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
