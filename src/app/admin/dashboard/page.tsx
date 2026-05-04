import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Download, BookOpen, FileSignature, Users, TrendingUp, Presentation, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { LiveBanner } from "./LiveBanner";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)]",
    SCHEDULED: "bg-[var(--color-primary-light)] text-white border-transparent",
    IN_PROGRESS: "bg-[var(--color-success)] text-white border-transparent",
    COMPLETED: "bg-[var(--color-text-muted)] text-white border-transparent",
    CANCELLED: "bg-[var(--color-danger)] text-white border-transparent",
  };
  const label =
    {
      DRAFT: "Rascunho",
      SCHEDULED: "Agendada",
      IN_PROGRESS: "Em Curso",
      COMPLETED: "Concluída",
      CANCELLED: "Cancelada",
    }[status] || status;
  return (
    <Badge className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || "bg-gray-400"} hover:opacity-90 transition-opacity`}>{label}</Badge>
  );
}

export const revalidate = 30;

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const tenantId = session.user.tenantId;

  const [activeActions, pendingDocs, totalTrainees, completed, totalEnrollments, recentActions] =
    await Promise.all([
      prisma.trainingAction.count({
        where: { tenantId, status: { in: ["IN_PROGRESS", "SCHEDULED"] } },
      }),
      prisma.documentSignature.count({
        where: {
          status: { in: ["PENDING", "ENABLED"] },
          OR: [
            { session: { trainingAction: { tenantId } } },
            { trainee: { tenantId } },
          ],
        },
      }),
      prisma.trainee.count({ where: { tenantId } }),
      prisma.enrollment.count({
        where: { trainingAction: { tenantId }, status: "COMPLETED" },
      }),
      prisma.enrollment.count({ where: { trainingAction: { tenantId } } }),
      prisma.trainingAction.findMany({
        where: { tenantId },
        include: {
          course: true,
          clientOrg: true,
          trainers: { include: { trainer: { include: { user: true } } } },
          sessions: true,
          enrollments: { include: { trainee: { include: { signatures: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

  const completionRate =
    totalEnrollments > 0 ? Math.round((completed / totalEnrollments) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold text-[var(--color-primary)] tracking-tight">Visão Geral</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">Acompanhe as métricas e turmas da sua entidade.</p>
      </div>

      <LiveBanner />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4" data-testid="kpis">
        <Card className="border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow bg-[var(--color-surface-2)]" data-testid="kpi-active-actions">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Turmas Ativas</p>
                <p className="text-3xl font-bold text-[var(--color-text)]">{activeActions}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                 <Presentation className="h-6 w-6 text-[var(--color-primary)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow bg-[var(--color-surface-2)]" data-testid="kpi-pending-docs">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Docs Pendentes</p>
                <p className="text-3xl font-bold text-[var(--color-text)]">{pendingDocs}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[var(--color-warning)]/10 flex items-center justify-center">
                 <Clock className="h-6 w-6 text-[var(--color-warning)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow bg-[var(--color-surface-2)]" data-testid="kpi-total-trainees">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Total Formandos</p>
                <p className="text-3xl font-bold text-[var(--color-text)]">{totalTrainees}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
                 <Users className="h-6 w-6 text-[var(--color-accent)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow bg-[var(--color-surface-2)]" data-testid="kpi-completion-rate">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Taxa de Conclusão</p>
                <div className="flex items-baseline gap-2">
                   <p className="text-3xl font-bold text-[var(--color-text)]">{completionRate}%</p>
                   <p className="text-xs text-[var(--color-text-muted)]">({completed}/{totalEnrollments})</p>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center">
                 <CheckCircle className="h-6 w-6 text-[var(--color-success)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de turmas recentes */}
      <Card className="border-[var(--color-border)] shadow-sm bg-[var(--color-surface-2)] overflow-hidden">
        <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/50">
          <CardTitle className="text-lg font-bold text-[var(--color-text)]">Turmas Recentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
               <BookOpen className="h-12 w-12 text-[var(--color-text-muted)] opacity-20 mb-3" />
               <p className="text-sm text-[var(--color-text-muted)]">Sem ações de formação ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="recent-actions">
                <thead>
                  <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                    <th className="px-6 py-4 rounded-tl-lg">Turma / Curso</th>
                    <th className="px-4 py-4">Formador</th>
                    <th className="px-4 py-4">Cliente</th>
                    <th className="px-4 py-4">Sessões</th>
                    <th className="px-4 py-4">Documentos</th>
                    <th className="px-4 py-4">Estado</th>
                    <th className="px-6 py-4 text-right rounded-tr-lg">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {recentActions.map((a) => {
                    const trainer =
                      a.trainers[0]?.trainer.user
                        ? `${a.trainers[0].trainer.user.firstName} ${a.trainers[0].trainer.user.lastName}`.trim()
                        : "—";
                    const totalSessions = a.sessions.length;
                    const closedSessions = a.sessions.filter((s) => s.isClosed).length;
                    const totalSigs = a.enrollments.reduce(
                      (acc, e) => acc + e.trainee.signatures.length,
                      0
                    );
                    const signedSigs = a.enrollments.reduce(
                      (acc, e) =>
                        acc + e.trainee.signatures.filter((s) => s.status === "SIGNED").length,
                      0
                    );
                    const docPct =
                      totalSigs > 0 ? Math.round((signedSigs / totalSigs) * 100) : 0;
                    return (
                      <tr key={a.id} className="hover:bg-[var(--color-surface)]/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">{a.course.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-border)] inline-block"></span>
                            {a.actionCode || a.id.slice(0, 8)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[var(--color-text-muted)]">{trainer}</td>
                        <td className="px-4 py-4 text-[var(--color-text-muted)]">{a.clientOrg?.name || "—"}</td>
                        <td className="px-4 py-4 text-[var(--color-text-muted)]">
                          <span className="font-medium text-[var(--color-text)]">{closedSessions}</span> / {totalSessions || 0}
                        </td>
                        <td className="px-4 py-4">
                           <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                                 <div className={`h-full ${docPct === 100 ? 'bg-[var(--color-success)]' : docPct > 50 ? 'bg-[var(--color-primary-light)]' : 'bg-[var(--color-warning)]'}`} style={{width: `${docPct}%`}}></div>
                              </div>
                              <span className="text-xs font-semibold text-[var(--color-text-muted)]">{docPct}%</span>
                           </div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button asChild variant="outline" size="sm" title="Ver detalhe" className="border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors">
                              <Link href={`/admin/actions/${a.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" title="Dossier PDF" className="border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors">
                              <Link href={`/api/pdf/${a.id}/REGISTO_PRESENCAS`}>
                                <Download className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
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
