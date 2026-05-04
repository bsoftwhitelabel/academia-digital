import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

export function renderProgramaFormacao(data: ActionPDFData): string {
  const { action, tenant, logos } = data;
  const c = action.course || {};
  const sessions = (action.sessions || []) as any[];

  const cronograma = sessions.length
    ? sessions
        .map(
          (s, i) => `<tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${esc(fmtDate(s.sessionDate))}</td>
            <td>${esc(s.startTime)} – ${esc(s.endTime)}</td>
            <td>${esc(s.durationHours)} h</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#999;padding:10px;">Sem sessões agendadas.</td></tr>`;

  const block = (title: string, content: any) =>
    content ? `<h2>${title}</h2><div style="font-size:10px;line-height:1.5;color:#333;">${esc(content)}</div>` : "";

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Programa de Formação", "2")}
    <table class="meta">
      <tr>
        <td class="lbl">Curso</td><td>${esc(c.name)}</td>
        <td class="lbl">Código</td><td>${esc(c.code || action.actionCode || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Área CITE</td><td>${esc(c.area?.name || "—")}</td>
        <td class="lbl">Duração</td><td>${esc(c.durationHours ?? "—")} h</td>
      </tr>
      <tr>
        <td class="lbl">Modalidade</td><td>${esc(action.format)}</td>
        <td class="lbl">Nível</td><td>${esc(c.qualificationLevel || "—")}</td>
      </tr>
    </table>

    ${block("Objetivos Gerais", c.objectives)}
    ${block("Objetivos Específicos", c.specificObjectives)}
    ${block("Destinatários", c.targetAudience)}
    ${block("Pré-requisitos", c.prerequisites)}
    ${block("Metodologia", c.methodology)}
    ${block("Avaliação", c.evaluationMethod)}

    <h2>Cronograma de Sessões</h2>
    <table class="data">
      <thead><tr><th style="width:24px;">Nº</th><th>Data</th><th>Horário</th><th>Duração</th></tr></thead>
      <tbody>${cronograma}</tbody>
    </table>
  `;
  return pageShell("Programa de Formação", body);
}
