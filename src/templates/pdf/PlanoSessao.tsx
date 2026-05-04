import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

const RECURSOS = ["Videoprojetor", "Computador", "Quadro", "Manual do Formando", "Testes", "Exercícios"];

export function renderPlanoSessao(data: ActionPDFData, sessionId?: string): string {
  const { action, tenant, logos } = data;
  const sessions = (action.sessions || []) as any[];
  const target = sessionId ? sessions.find((s) => s.id === sessionId) : sessions[0];

  if (!target) {
    return pageShell("Plano de Sessão", `${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Plano de Sessão", "3")}<p>Sem sessões.</p>`);
  }

  const used = new Set<string>(target.didacticResources || []);
  const checklist = RECURSOS.map(
    (r) =>
      `<tr><td style="width:24px;text-align:center;">${used.has(r) ? "☑" : "☐"}</td><td>${esc(r)}</td></tr>`
  ).join("");

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Plano de Sessão", "3")}
    <table class="meta">
      <tr>
        <td class="lbl">Curso</td><td>${esc(action.course?.name)}</td>
        <td class="lbl">Sessão</td><td>${esc(fmtDate(target.sessionDate))}</td>
      </tr>
      <tr>
        <td class="lbl">Horário</td><td>${esc(target.startTime)} – ${esc(target.endTime)}</td>
        <td class="lbl">Duração</td><td>${esc(target.durationHours)} h</td>
      </tr>
      <tr>
        <td class="lbl">Local</td>
        <td colspan="3">${esc(action.room?.name || "—")}</td>
      </tr>
    </table>
    <h2>Conteúdos / Sumário</h2>
    <div style="border:1px solid #e0e0e0;padding:10px;min-height:80px;font-size:10px;line-height:1.5;">
      ${esc(target.summary || "Sem sumário registado.")}
    </div>
    <h2>Recursos Didáticos Utilizados</h2>
    <table class="data" style="width:60%;"><tbody>${checklist}</tbody></table>
  `;
  return pageShell("Plano de Sessão", body);
}
