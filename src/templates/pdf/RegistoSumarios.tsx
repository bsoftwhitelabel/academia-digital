import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

export function renderRegistoSumarios(data: ActionPDFData): string {
  const { action, tenant, logos } = data;
  const sessions = (action.sessions || []) as any[];

  const rows = sessions.length
    ? sessions
        .map((s, i) => {
          const summary = s.summary || "Sem sumário registado.";
          const sigImg = s.trainerSignatureUrl
            ? `<img src="${esc(s.trainerSignatureUrl)}" style="max-height:30px;max-width:140px;" />`
            : '<div style="border-bottom:1px solid #999;height:24px;"></div>';
          return `<tr>
            <td style="text-align:center;width:24px;">${i + 1}</td>
            <td style="width:80px;">${esc(fmtDate(s.sessionDate))}</td>
            <td style="width:90px;">${esc(s.startTime)} – ${esc(s.endTime)}</td>
            <td>${esc(summary)}</td>
            <td style="width:160px;text-align:center;">${sigImg}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#999;padding:14px;">Sem sessões.</td></tr>`;

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Registo de Sumários", "9")}
    <table class="meta">
      <tr>
        <td class="lbl">Curso</td><td>${esc(action.course?.name)}</td>
        <td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td>
      </tr>
    </table>
    <h2>Sumários por Sessão</h2>
    <table class="data">
      <thead>
        <tr>
          <th style="width:24px;">Nº</th>
          <th style="width:80px;">Data</th>
          <th style="width:90px;">Horário</th>
          <th>Sumário / Conteúdos lecionados</th>
          <th style="width:160px;">Assinatura do Formador</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Observações</h2>
    <div style="border:1px solid #e0e0e0;padding:10px;min-height:60px;"></div>
  `;
  return pageShell("Registo de Sumários", body);
}
