import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlanRowActions } from "./PlanRowActions";

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-400",
  SUBMITTED: "bg-amber-500",
  APPROVED: "bg-blue-600",
  ACTIVE: "bg-green-600",
  COMPLETED: "bg-gray-500",
};

export default async function TrainingPlansPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/admin/dashboard");
  }

  const plans = await prisma.trainingPlan.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      _count: { select: { trainingActions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Planos de Formação</h1>
        <p className="text-sm text-gray-600">{plans.length} planos no tenant.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg text-[#0B2447]">Planos</CardTitle></CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Sem planos.</p>
          ) : (
            <table className="w-full text-sm" data-testid="plans-table">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="px-2 py-2">Nome</th>
                  <th className="px-2 py-2">Ano</th>
                  <th className="px-2 py-2">Período</th>
                  <th className="px-2 py-2">Ações</th>
                  <th className="px-2 py-2">Estado</th>
                  <th className="px-2 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-2 py-2 font-semibold text-[#0B2447]">{p.name}</td>
                    <td className="px-2 py-2">{p.year || "—"}</td>
                    <td className="px-2 py-2 text-xs">{fmt(p.startDate)} → {fmt(p.endDate)}</td>
                    <td className="px-2 py-2">{p._count.trainingActions}</td>
                    <td className="px-2 py-2">
                      <Badge className={`${STATUS_COLORS[p.status] || "bg-gray-400"} text-white hover:opacity-90`}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <PlanRowActions planId={p.id} status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500">
        Estados: DRAFT (em rascunho) · SUBMITTED (a aguardar aprovação) · APPROVED · ACTIVE · COMPLETED. Use{" "}
        <Link className="underline" href="/admin/approvals">/admin/approvals</Link> para rever pedidos pendentes.
      </p>
    </div>
  );
}
