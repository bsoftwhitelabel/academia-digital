import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { logAudit, diffFields } from "@/lib/audit";

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized", status: 401 as const };
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { ok: true, session } as const;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorize();
  if (!("ok" in auth)) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json();

  const existing = await prisma.course.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });
  if (existing.tenantId !== auth.session.user.tenantId && auth.session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cross-tenant" }, { status: 403 });
  }

  try {
    const slug = body.slug ? slugify(body.slug) : (body.name ? slugify(body.name) : existing.slug);
    const updated = await prisma.course.update({
      where: { id: params.id },
      data: {
        name: body.name ?? existing.name,
        slug,
        sigla: body.sigla ?? existing.sigla,
        code: body.code ?? existing.code,
        durationHours: body.durationHours != null ? Number(body.durationHours) : existing.durationHours,
        format: body.format ?? existing.format,
        areaId: body.areaId ?? existing.areaId,
        shortDescription: body.shortDescription ?? existing.shortDescription,
        fullDescription: body.fullDescription ?? existing.fullDescription,
        objectives: body.objectives ?? existing.objectives,
        targetAudience: body.targetAudience ?? existing.targetAudience,
        methodology: body.methodology ?? existing.methodology,
        evaluationMethod: body.evaluationMethod ?? existing.evaluationMethod,
        coverImageUrl: body.coverImageUrl ?? existing.coverImageUrl,
        price: body.price != null ? Number(body.price) : existing.price,
        priceNotes: body.priceNotes ?? existing.priceNotes,
        tags: Array.isArray(body.tags) ? body.tags : existing.tags,
        seoTitle: body.seoTitle ?? existing.seoTitle,
        seoDescription: body.seoDescription ?? existing.seoDescription,
        status: body.status ?? existing.status,
        publishedAt:
          (body.status === "PUBLISHED" || body.status === "FEATURED") && !existing.publishedAt
            ? new Date()
            : existing.publishedAt,
      },
    });

    // Diff dos campos alterados (ignora timestamps automáticos)
    const diff = diffFields(existing as any, updated as any);
    await logAudit({
      action: "UPDATE",
      resource: "Course",
      resourceId: updated.id,
      userId: auth.session.user.id,
      tenantId: existing.tenantId,
      changes: diff,
      req,
    });

    return NextResponse.json({ success: true, courseId: updated.id, slug: updated.slug, status: updated.status });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Slug já existe" }, { status: 409 });
    }
    console.error("PUT /admin/courses error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
