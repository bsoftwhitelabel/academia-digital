import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { logAudit } from "@/lib/audit";

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
  if (!body.name) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }
  const slug = body.slug?.trim() ? slugify(body.slug) : slugify(body.name);
  try {
    const course = await prisma.course.create({
      data: {
        tenantId: auth.session.user.tenantId,
        name: body.name,
        slug,
        sigla: body.sigla ?? null,
        code: body.code ?? null,
        durationHours: Number(body.durationHours ?? 0),
        format: body.format ?? "PRESENCIAL",
        areaId: body.areaId ?? null,
        shortDescription: body.shortDescription ?? null,
        fullDescription: body.fullDescription ?? null,
        objectives: body.objectives ?? null,
        targetAudience: body.targetAudience ?? null,
        methodology: body.methodology ?? null,
        evaluationMethod: body.evaluationMethod ?? null,
        coverImageUrl: body.coverImageUrl ?? null,
        price: body.price != null ? Number(body.price) : null,
        priceNotes: body.priceNotes ?? null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        seoTitle: body.seoTitle ?? null,
        seoDescription: body.seoDescription ?? null,
        status: body.status ?? "DRAFT",
        publishedAt: body.status === "PUBLISHED" || body.status === "FEATURED" ? new Date() : null,
      },
    });
    await logAudit({
      action: "CREATE",
      resource: "Course",
      resourceId: course.id,
      userId: auth.session.user.id,
      tenantId: course.tenantId,
      changes: {
        after: {
          name: course.name, slug: course.slug, status: course.status,
          format: course.format, durationHours: course.durationHours,
        },
      },
      req,
    });

    return NextResponse.json({ success: true, courseId: course.id, slug: course.slug });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Slug já existe" }, { status: 409 });
    }
    console.error("POST /admin/courses error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
