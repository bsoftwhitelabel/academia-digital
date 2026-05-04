import type { LogoSet } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

export type SatisfactionData = {
  tenant: { name: string };
  action: { course: { name: string }; actionCode: string | null; startDate: Date; endDate: Date; clientOrg?: { name: string | null } | null };
  logos: LogoSet;
  blocks: Array<{ label: string; average: number; count: number }>;
  distribution: Array<{ score: number; count: number }>;
  totalResponded: number;
  totalGenerated: number;
};

function svgBarChart(data: Array<{ label: string; value: number; max: number }>): string {
  // SVG inline simples; Puppeteer renderiza
  const w = 520, h = 180, pad = 30;
  const barW = (w - pad * 2) / Math.max(1, data.length);
  const max = data.reduce((m, d) => Math.max(m, d.max), 5);
  const bars = data
    .map((d, i) => {
      const x = pad + i * barW + 6;
      const bw = barW - 12;
      const bh = (d.value / max) * (h - pad * 2);
      const y = h - pad - bh;
      return `<g>
        <rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#0B2447" rx="3" />
        <text x="${x + bw / 2}" y="${h - pad + 12}" text-anchor="middle" font-size="9" fill="#666">${esc(d.label)}</text>
        <text x="${x + bw / 2}" y="${y - 3}" text-anchor="middle" font-size="9" fill="#0B2447" font-weight="bold">${d.value.toFixed(1)}</text>
      </g>`;
    })
    .join("");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#999" stroke-width="1" />
    ${bars}
  </svg>`;
}

export function renderRelatorioSatisfacao(data: SatisfactionData): string {
  const { tenant, action, logos, blocks, distribution, totalResponded, totalGenerated } = data;
  const responseRate = totalGenerated > 0 ? Math.round((totalResponded / totalGenerated) * 100) : 0;

  const blocksRows = blocks
    .map(
      (b) => `<tr>
        <td>${esc(b.label)}</td>
        <td style="text-align:center;font-weight:bold;color:#0B2447;">${b.average.toFixed(2)}</td>
        <td style="text-align:center;">${b.count}</td>
      </tr>`
    )
    .join("") || `<tr><td colspan="3" style="text-align:center;color:#999;padding:14px;">Sem respostas.</td></tr>`;

  const distRows = distribution
    .map(
      (d) => `<tr>
        <td style="text-align:center;font-weight:600;">${d.score}</td>
        <td style="text-align:center;">${d.count}</td>
        <td>
          <div style="background:#0B2447;height:10px;width:${Math.min(100, d.count * 10)}%;border-radius:2px;"></div>
        </td>
      </tr>`
    )
    .join("");

  const chartBars = blocks.map((b) => ({ label: b.label, value: b.average, max: 5 }));
  const chart = chartBars.length > 0 ? svgBarChart(chartBars) : "";

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Relatório de Avaliação de Satisfação", "12/14")}
    <table class="meta">
      <tr>
        <td class="lbl">Curso</td><td>${esc(action.course?.name)}</td>
        <td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Período</td><td>${esc(fmtDate(action.startDate))} a ${esc(fmtDate(action.endDate))}</td>
        <td class="lbl">Cliente</td><td>${esc(action.clientOrg?.name || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Respostas</td><td><strong>${totalResponded}</strong> de ${totalGenerated} (${responseRate}%)</td>
        <td class="lbl">Data emissão</td><td>${esc(fmtDate(new Date()))}</td>
      </tr>
    </table>

    <h2>Médias por Bloco de Avaliação</h2>
    <table class="data" style="width:80%;">
      <thead>
        <tr>
          <th>Bloco</th>
          <th style="text-align:center;width:80px;">Média (1-5)</th>
          <th style="text-align:center;width:80px;">Respostas</th>
        </tr>
      </thead>
      <tbody>${blocksRows}</tbody>
    </table>

    ${chart ? `<h2>Visualização</h2><div style="text-align:center;margin-top:8px;">${chart}</div>` : ""}

    <h2>Distribuição de Respostas (escala 1-5)</h2>
    <table class="data" style="width:60%;">
      <thead>
        <tr>
          <th style="width:50px;">Nota</th>
          <th style="width:80px;">Total</th>
          <th>Distribuição</th>
        </tr>
      </thead>
      <tbody>${distRows || `<tr><td colspan="3" style="color:#999;text-align:center;padding:8px;">Sem respostas.</td></tr>`}</tbody>
    </table>

    <div class="signature-area" style="margin-top:36px;">
      <div class="cell">
        <div class="label">Responsável de Formação</div>
        <div class="area"></div>
        <div class="small">${esc(tenant?.name)}</div>
      </div>
      <div class="cell">
        <div class="label">Coordenador Pedagógico</div>
        <div class="area"></div>
      </div>
    </div>
  `;
  return pageShell("Relatório de Satisfação", body);
}
