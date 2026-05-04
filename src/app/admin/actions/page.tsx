import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Eye } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { SigoExport } from "./SigoExport";

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export default async function AdminActionsPage({
  searchParams,
}: {
  searchParams: { client?: string; status?: string; date?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const tenantId = session.user.tenantId;

  const where: Prisma.TrainingActionWhereInput = { tenantId };
  if (searchParams.client) where.clientOrgId = searchParams.client;
  if (searchParams.status) where.status = searchParams.status as any;

  const [actions, clients] = await Promise.all([
    prisma.trainingAction.findMany({
      where,
      include: {
        course: true,
        clientOrg: true,
        trainers: { include: { trainer: { include: { user: true } } } },
        sessions: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientOrg.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Ações de Formação</h1>
          <p className="text-sm text-gray-600">{actions.length} ações.</p>
        </div>
        <Button asChild className="bg-[#0B2447] hover:bg-[#153460]">
          <Link href="/admin/actions/new">
            <Plus className="mr-2 h-4 w-4" /> Nova Ação
          </Link>
        </Button>
      </div>

      <SigoExport
        actions={actions.map((a) => ({
          id: a.id,
          code: a.actionCode || a.id.slice(0, 8),
          label: a.course.name,
          enrollments: a._count.enrollments,
        }))}
      />

      <Card>
        <CardHeader className="border-b">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-3" method="GET">
            <select name="client" defaultValue={searchParams.client ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Cliente (todos)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select name="status" defaultValue={searchParams.status ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Estado (todos)</option>
              <option value="DRAFT">Rascunho</option>
              <option value="SCHEDULED">Agendada</option>
              <option value="IN_PROGRESS">Em Curso</option>
              <option value="COMPLETED">Concluída</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
            <Button type="submit" variant="outline">Filtrar</Button>
          </form>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Sem ações.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-gray-500">
                    <th className="px-2 py-2">Curso</th>
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Formador</th>
                    <th className="px-2 py-2">Datas</th>
                    <th className="px-2 py-2">Sessões</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => {
                    const trainer =
                      a.trainers[0]?.trainer.user
                        ? `${a.trainers[0].trainer.user.firstName} ${a.trainers[0].trainer.user.lastName}`.trim()
                        : "—";
                    const closed = a.sessions.filter((s) => s.isClosed).length;
                    return (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-2 py-2">
                          <div className="font-semibold text-[#0B2447]">{a.course.name}</div>
                          <div className="text-xs text-gray-500">{a.actionCode || a.id.slice(0, 8)}</div>
                        </td>
                        <td className="px-2 py-2">{a.clientOrg?.name || "—"}</td>
                        <td className="px-2 py-2">{trainer}</td>
                        <td className="px-2 py-2 text-xs">
                          {fmtDate(a.startDate)} → {fmtDate(a.endDate)}
                        </td>
                        <td className="px-2 py-2">{closed}/{a.sessions.length}</td>
                        <td className="px-2 py-2">
                          <Badge>{a.status}</Badge>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Button asChild variant="ghost" size="icon-sm">
                            <Link href={`/admin/actions/${a.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
