import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, TrendingUp, Layers } from "lucide-react";

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("pt-PT", { dateStyle: "short" });
}

export default async function CatalogAnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/admin/dashboard");
  }
  const tenantId = session.user.tenantId;
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const inquiries = await prisma.inquiry.findMany({
    where: { tenantId, createdAt: { gte: since } },
  });

  // Agrupar por courseId
  const byCourse: Record<string, { courseId: string; courseName: string; count: number; last: Date }> = {};
  for (const inq of inquiries) {
    const key = inq.courseId || "unknown";
    if (!byCourse[key]) {
      byCourse[key] = {
        courseId: key,
        courseName: inq.courseName || "(sem curso)",
        count: 0,
        last: inq.createdAt,
      };
    }
    byCourse[key].count += 1;
    if (inq.createdAt > byCourse[key].last) byCourse[key].last = inq.createdAt;
  }
  const ranking = Object.values(byCourse).sort((a, b) => b.count - a.count);

  // Top 3 áreas via course.areaId
  const courseIds = Object.keys(byCourse).filter((id) => id !== "unknown");
  const courses =
    courseIds.length > 0
      ? await prisma.course.findMany({
          where: { id: { in: courseIds } },
          include: { area: true },
        })
      : [];
  const byArea: Record<string, { name: string; count: number }> = {};
  for (const c of courses) {
    const inq = byCourse[c.id];
    if (!inq) continue;
    const areaName = c.area?.name || "Sem área";
    if (!byArea[areaName]) byArea[areaName] = { name: areaName, count: 0 };
    byArea[areaName].count += inq.count;
  }
  const top3Areas = Object.values(byArea).sort((a, b) => b.count - a.count).slice(0, 3);

  // Total publications (para taxa de conversão estimada)
  const publishedCount = await prisma.course.count({
    where: { tenantId, status: { in: ["PUBLISHED", "FEATURED"] } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Analytics do Catálogo</h1>
        <p className="text-sm text-gray-600">Inquiries dos últimos 30 dias.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Total inquiries</CardTitle>
            <Inbox className="h-4 w-4 text-[#C9A520]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#0B2447]" data-testid="kpi-total-inquiries">
              {inquiries.length}
            </div>
            <p className="mt-1 text-xs text-gray-500">últimos 30 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Cursos com interesse</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#C9A520]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#0B2447]">{ranking.length}</div>
            <p className="mt-1 text-xs text-gray-500">
              de {publishedCount} cursos publicados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Top área</CardTitle>
            <Layers className="h-4 w-4 text-[#C9A520]" />
          </CardHeader>
          <CardContent>
            {top3Areas[0] ? (
              <>
                <div className="text-base font-semibold text-[#0B2447]">{top3Areas[0].name}</div>
                <p className="text-sm text-gray-600">{top3Areas[0].count} inquiries</p>
              </>
            ) : (
              <span className="text-sm text-gray-400">Sem dados</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#0B2447]">Cursos com mais interesse</CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Sem inquiries no período.</p>
          ) : (
            <table className="w-full text-sm" data-testid="ranking-table">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="px-2 py-2">Curso</th>
                  <th className="px-2 py-2">Inquiries</th>
                  <th className="px-2 py-2">Última</th>
                  <th className="px-2 py-2">Taxa estimada</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => {
                  // Taxa de conversão estimada: ratio inquiries / publicações totais (proxy)
                  const conv = publishedCount > 0 ? Math.round((r.count / publishedCount) * 100) : 0;
                  return (
                    <tr key={r.courseId} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium text-gray-800">{r.courseName}</td>
                      <td className="px-2 py-2 font-bold text-[#15803D]">{r.count}</td>
                      <td className="px-2 py-2 text-xs">{fmt(r.last)}</td>
                      <td className="px-2 py-2 text-xs text-gray-600">{conv}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {top3Areas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#0B2447]">Top 3 áreas com interesse</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {top3Areas.map((a, i) => (
                <li key={a.name} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2">
                  <span>
                    <strong className="text-[#15803D]">#{i + 1}</strong> · {a.name}
                  </span>
                  <span className="font-bold text-gray-700">{a.count} inquiries</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-gray-500">
        Page-views e tracking de cliques em tempo real disponíveis em{" "}
        <a className="underline" href="https://vercel.com/analytics" target="_blank" rel="noreferrer">
          vercel.com/analytics
        </a>{" "}
        após deploy.
      </p>
    </div>
  );
}
