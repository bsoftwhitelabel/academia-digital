import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 20;

function fmtDateTime(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mn = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mn}`;
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    CREATE: "bg-green-600",
    UPDATE: "bg-blue-600",
    DELETE: "bg-red-600",
    VIEW: "bg-gray-400",
    LOGIN: "bg-[#0B2447]",
    LOGOUT: "bg-gray-500",
  };
  return <Badge className={`${map[action] || "bg-gray-400"} text-white hover:opacity-90`}>{action}</Badge>;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { page?: string; user?: string; action?: string; from?: string; to?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  // Apenas TENANT_ADMIN (não TENANT_STAFF)
  if (session.user.role !== "TENANT_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard");
  }

  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const where: Prisma.AuditLogWhereInput = { tenantId: session.user.tenantId };
  if (searchParams.user) where.userId = searchParams.user;
  if (searchParams.action) where.action = searchParams.action;
  if (searchParams.from || searchParams.to) {
    where.createdAt = {} as any;
    if (searchParams.from) (where.createdAt as any).gte = new Date(searchParams.from);
    if (searchParams.to) {
      const t = new Date(searchParams.to);
      t.setUTCHours(23, 59, 59, 999);
      (where.createdAt as any).lte = t;
    }
  }

  const [total, logs, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.user.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: "asc" },
      take: 50,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Logs de Auditoria</h1>
        <p className="text-sm text-gray-600">{total} registos · página {page} de {totalPages}</p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <form method="GET" className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <select name="user" defaultValue={searchParams.user ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Utilizador (todos)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
            <select name="action" defaultValue={searchParams.action ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Ação (todas)</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="VIEW">VIEW</option>
              <option value="LOGIN">LOGIN</option>
              <option value="LOGOUT">LOGOUT</option>
            </select>
            <input name="from" type="date" defaultValue={searchParams.from ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm" />
            <input name="to" type="date" defaultValue={searchParams.to ?? ""}
              className="rounded border border-gray-300 px-3 py-2 text-sm" />
            <Button type="submit" variant="outline">Filtrar</Button>
          </form>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Sem registos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="audit-table">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-gray-500">
                    <th className="px-2 py-2">Data/hora (UTC)</th>
                    <th className="px-2 py-2">Utilizador</th>
                    <th className="px-2 py-2">Ação</th>
                    <th className="px-2 py-2">Recurso</th>
                    <th className="px-2 py-2">IP</th>
                    <th className="px-2 py-2">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b last:border-0 align-top">
                      <td className="px-2 py-2 font-mono text-xs">{fmtDateTime(l.createdAt)}</td>
                      <td className="px-2 py-2">
                        {l.user ? `${l.user.firstName} ${l.user.lastName}` : "—"}
                        <div className="text-xs text-gray-500">{l.user?.email || ""}</div>
                      </td>
                      <td className="px-2 py-2"><ActionBadge action={l.action} /></td>
                      <td className="px-2 py-2">
                        <div className="font-semibold text-[#0B2447]">{l.resource}</div>
                        {l.resourceId && (
                          <div className="text-xs text-gray-500 font-mono">
                            {l.resourceId.slice(0, 12)}…
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{l.ipAddress || "—"}</td>
                      <td className="px-2 py-2 max-w-md">
                        {l.changes ? (
                          <details>
                            <summary className="cursor-pointer text-xs text-blue-600 hover:underline">
                              ver changes
                            </summary>
                            <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                              {JSON.stringify(l.changes, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <Link
                href={{
                  pathname: "/admin/settings/audit",
                  query: { ...searchParams, page: String(Math.max(1, page - 1)) },
                }}
                className={`rounded border px-3 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
              >
                ← Anterior
              </Link>
              <span className="text-gray-500">{page} de {totalPages}</span>
              <Link
                href={{
                  pathname: "/admin/settings/audit",
                  query: { ...searchParams, page: String(Math.min(totalPages, page + 1)) },
                }}
                className={`rounded border px-3 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
              >
                Seguinte →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
