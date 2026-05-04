import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generatePDF } from "@/lib/pdf";

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmtEur(n: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const plan = await prisma.trainingPlan.findUnique({ where: { id: params.id } });
  if (!plan || plan.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: plan.tenantId } });

  const actions = await prisma.trainingAction.findMany({
    where: { planId: plan.id, tenantId: plan.tenantId },
    include: { course: true },
  });
  const actionIds = actions.map((a) => a.id);
  const [budgets, allCosts] = await Promise.all([
    prisma.budget.findMany({ where: { trainingActionId: { in: actionIds } } }),
    prisma.trainingCost.findMany({ where: { trainingActionId: { in: actionIds } } }),
  ]);
  const planBudget = await prisma.budget.findUnique({ where: { trainingPlanId: plan.id } });

  const year = plan.year || new Date().getUTCFullYear();
  const monthly: { month: number; budgeted: number; spent: number }[] = [];
  for (let i = 0; i < 12; i++) monthly.push({ month: i, budgeted: 0, spent: 0 });

  const totalBudget = planBudget?.budgetedAmount || actions.reduce((s, a) => {
    const b = budgets.find((bb) => bb.trainingActionId === a.id);
    return s + (b?.budgetedAmount || 0);
  }, 0);
  const perMonth = totalBudget / 12;
  for (const m of monthly) m.budgeted = perMonth;

  for (const c of allCosts) {
    if (c.date.getUTCFullYear() === year) {
      monthly[c.date.getUTCMonth()].spent += c.amount;
    }
  }
  const totalSpent = allCosts.reduce((s, c) => s + c.amount, 0);
  const desvio = totalSpent - totalBudget;
  const desvioPct = totalBudget > 0 ? (desvio / totalBudget) * 100 : 0;
  const usagePct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const actionRows = actions.map((a) => {
    const b = budgets.find((bb) => bb.trainingActionId === a.id);
    const sp = allCosts.filter((c) => c.trainingActionId === a.id).reduce((s, c) => s + c.amount, 0);
    const bg = b?.budgetedAmount || 0;
    const dv = sp - bg;
    const pct = bg > 0 ? (sp / bg) * 100 : 0;
    return {
      code: a.actionCode || a.id.slice(0, 8),
      name: a.course.name,
      budgeted: bg,
      spent: sp,
      desvio: dv,
      pct,
    };
  });

  const maxBar = Math.max(...monthly.map((m) => Math.max(m.budgeted, m.spent)), 1);

  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="UTF-8" />
<title>Relatório Orçamental — ${escapeHtml(plan.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
  h1 { color: #0B2447; font-size: 22px; margin: 0 0 4px; }
  h2 { color: #0B2447; font-size: 14px; margin: 24px 0 8px; border-bottom: 2px solid #C9A520; padding-bottom: 4px; }
  .sub { color: #6b7280; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0B2447; padding-bottom: 12px; margin-bottom: 16px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .kpi .label { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: .05em; }
  .kpi .value { font-size: 20px; font-weight: 700; color: #0B2447; margin-top: 4px; }
  .kpi .red { color: #b91c1c; }
  .kpi .green { color: #15803d; }
  .progress { height: 10px; background: #e5e7eb; border-radius: 999px; overflow: hidden; margin: 4px 0; }
  .progress > div { height: 100%; background: #15803d; }
  .progress.warn > div { background: #f59e0b; }
  .progress.over > div { background: #dc2626; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #0B2447; color: white; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .right { text-align: right; }
  .chart { display: flex; align-items: flex-end; gap: 6px; height: 160px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px; }
  .month-col { flex: 1; display: flex; flex-direction: column; align-items: center; }
  .bars { display: flex; gap: 2px; align-items: flex-end; height: 130px; width: 100%; justify-content: center; }
  .bar { width: 12px; border-radius: 2px 2px 0 0; }
  .bar.budget { background: #0B2447; }
  .bar.spent { background: #C9A520; }
  .month-label { font-size: 9px; color: #6b7280; margin-top: 4px; }
  .legend { display: flex; gap: 12px; font-size: 11px; margin: 8px 0; }
  .legend .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
  footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Relatório Orçamental — ${escapeHtml(plan.name)}</h1>
      <p class="sub">Ano ${year} · ${escapeHtml(tenant?.name || "")}</p>
    </div>
    <div class="sub">Gerado: ${new Date().toLocaleDateString("pt-PT")}</div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="label">Orçado</div>
      <div class="value">${fmtEur(totalBudget)}</div>
    </div>
    <div class="kpi">
      <div class="label">Gasto</div>
      <div class="value">${fmtEur(totalSpent)}</div>
      <div class="sub">${usagePct.toFixed(1)}% do orçamento</div>
    </div>
    <div class="kpi">
      <div class="label">Desvio</div>
      <div class="value ${desvio > 0 ? "red" : "green"}">${desvio >= 0 ? "+" : ""}${fmtEur(desvio)}</div>
      <div class="sub">${desvioPct >= 0 ? "+" : ""}${desvioPct.toFixed(1)}%</div>
    </div>
  </div>

  <h2>Execução orçamental</h2>
  <div class="progress ${usagePct > 100 ? "over" : usagePct >= 80 ? "warn" : ""}">
    <div style="width: ${Math.min(usagePct, 100).toFixed(1)}%"></div>
  </div>

  <h2>Orçado vs. gasto por mês</h2>
  <div class="legend">
    <span><span class="swatch" style="background:#0B2447"></span>Orçado</span>
    <span><span class="swatch" style="background:#C9A520"></span>Gasto</span>
  </div>
  <div class="chart">
    ${monthly.map((m, i) => {
      const hb = (m.budgeted / maxBar) * 130;
      const hs = (m.spent / maxBar) * 130;
      return `<div class="month-col">
        <div class="bars">
          <div class="bar budget" style="height:${hb}px" title="${fmtEur(m.budgeted)}"></div>
          <div class="bar spent" style="height:${hs}px" title="${fmtEur(m.spent)}"></div>
        </div>
        <div class="month-label">${MONTHS_PT[i]}</div>
      </div>`;
    }).join("")}
  </div>

  <h2>Ações de formação</h2>
  ${actionRows.length === 0 ? `<p class="sub">Sem ações registadas neste plano.</p>` : `
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Ação</th>
        <th class="right">Orçado</th>
        <th class="right">Gasto</th>
        <th class="right">Desvio</th>
        <th class="right">%</th>
      </tr>
    </thead>
    <tbody>
      ${actionRows.map((r) => `
        <tr>
          <td>${escapeHtml(r.code)}</td>
          <td>${escapeHtml(r.name)}</td>
          <td class="right">${fmtEur(r.budgeted)}</td>
          <td class="right">${fmtEur(r.spent)}</td>
          <td class="right">${r.desvio >= 0 ? "+" : ""}${fmtEur(r.desvio)}</td>
          <td class="right">${r.pct.toFixed(0)}%</td>
        </tr>
      `).join("")}
    </tbody>
  </table>`}

  <footer>
    ${escapeHtml(tenant?.name || "Academia Digital")} · Relatório orçamental · ${new Date().toISOString().slice(0, 10)}
  </footer>
</body>
</html>`;

  const pdf = await generatePDF(html, { format: "A4" });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="orcamento-${plan.name.replace(/[^a-z0-9]/gi, "_")}-${year}.pdf"`,
    },
  });
}
