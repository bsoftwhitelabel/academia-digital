import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Pencil, Eye, Archive } from "lucide-react";
import type { Prisma } from "@prisma/client";

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: { q?: string; format?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const tenantId = session.user.tenantId;

  const where: Prisma.CourseWhereInput = { tenantId };
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: "insensitive" } },
      { code: { contains: searchParams.q, mode: "insensitive" } },
      { shortDescription: { contains: searchParams.q, mode: "insensitive" } },
    ];
  }
  if (searchParams.format) where.format = searchParams.format as any;
  if (searchParams.status) where.status = searchParams.status as any;

  const [courses, areas, tenant] = await Promise.all([
    prisma.course.findMany({
      where, include: { area: true }, orderBy: { createdAt: "desc" },
    }),
    prisma.trainingArea.findMany({ orderBy: { name: "asc" } }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Cursos</h1>
          <p className="text-sm text-gray-600">{courses.length} cursos no tenant.</p>
        </div>
        <Button asChild className="bg-[#0B2447] hover:bg-[#153460]">
          <Link href="/admin/courses/new" data-testid="new-course">
            <Plus className="mr-2 h-4 w-4" /> Novo Curso
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" method="GET">
            <input
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Pesquisar nome / código…"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              data-testid="filter-q"
            />
            <select
              name="format"
              defaultValue={searchParams.format ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Modalidade (todas)</option>
              <option value="PRESENCIAL">Presencial</option>
              <option value="ELEARNING">E-learning</option>
              <option value="BLENDED">Blended</option>
            </select>
            <select
              name="status"
              defaultValue={searchParams.status ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Estado (todos)</option>
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="FEATURED">Em Destaque</option>
              <option value="ARCHIVED">Arquivado</option>
            </select>
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Sem resultados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="courses-table">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-gray-500">
                    <th className="px-2 py-2">Nome</th>
                    <th className="px-2 py-2">Área</th>
                    <th className="px-2 py-2">Modalidade</th>
                    <th className="px-2 py-2">Duração</th>
                    <th className="px-2 py-2">Preço</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <div className="font-semibold text-[#0B2447]">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.code || c.slug}</div>
                      </td>
                      <td className="px-2 py-2">{c.area?.name || "—"}</td>
                      <td className="px-2 py-2">{c.format}</td>
                      <td className="px-2 py-2">{c.durationHours} h</td>
                      <td className="px-2 py-2">{c.price ? `${c.price} €` : "—"}</td>
                      <td className="px-2 py-2">
                        <CourseStatusBadge status={c.status} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="icon-sm" title="Editar">
                            <Link href={`/admin/courses/${c.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="icon-sm" title="Catálogo">
                            <Link href={`/${tenant?.slug}/catalog/${c.slug}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="icon-sm"
                            title="Arquivar"
                          >
                            <Link href={`/admin/courses/${c.id}/edit?archive=1`}>
                              <Archive className="h-4 w-4 text-red-500" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CourseStatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    DRAFT: { color: "bg-gray-400", label: "Rascunho" },
    PUBLISHED: { color: "bg-green-600", label: "Publicado" },
    FEATURED: { color: "bg-[#C9A520]", label: "Em Destaque" },
    ARCHIVED: { color: "bg-red-500", label: "Arquivado" },
  };
  const m = map[status] || { color: "bg-gray-400", label: status };
  return <Badge className={`${m.color} text-white hover:opacity-90`}>{m.label}</Badge>;
}
