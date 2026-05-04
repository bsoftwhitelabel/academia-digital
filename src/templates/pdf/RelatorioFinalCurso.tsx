import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

export function renderRelatorioFinal(data: ActionPDFData): string {
  const { action, tenant, trainees, logos } = data;
  const sessions = (action.sessions || []) as any[];
  const totalPossible = trainees.length * sessions.length;
  let totalPresent = 0;
  for (const t of trainees) {
    totalPresent += ((t.checkIns || []) as any[]).filter((c) => c.status !== "ABSENT").length;
  }
  const presenceRate = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;

  const enrolments = (action.enrollments || []) as any[];
  const passed = enrolments.filter((e) => e.passed === true).length;
  const failed = enrolments.filter((e) => e.passed === false).length;
  const inProgress = enrolments.length - passed - failed;

  const occurrences = (action.occurrences || []) as any[];
  const trainerSummary =
    sessions
      .map((s) => s.summary)
      .filter(Boolean)
      .join(" · ") || "Sem síntese registada.";

  const trainerNames =
    (action.trainers || [])
      .map((t: any) => `${t.trainer?.user?.firstName || ""} ${t.trainer?.user?.lastName || ""}`.trim())
      .filter(Boolean)
      .join(", ") || "—";

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Relatório Final do Curso", "18")}
    <h2>Resumo Executivo</h2>
    <table class="meta">
      <tr>
        <td class="lbl">Curso</td><td>${esc(action.course?.name)}</td>
        <td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Datas</td><td>${esc(fmtDate(action.startDate))} a ${esc(fmtDate(action.endDate))}</td>
        <td class="lbl">Total horas</td><td>${esc(action.course?.durationHours ?? "—")} h</td>
      </tr>
      <tr>
        <td class="lbl">Local</td><td>${esc(action.room?.name || "—")}</td>
        <td class="lbl">Modalidade</td><td>${esc(action.format)}</td>
      </tr>
      <tr>
        <td class="lbl">Formador(es)</td><td colspan="3">${esc(trainerNames)}</td>
      </tr>
    </table>

    <h2>Indicadores</h2>
    <table class="data" style="width:80%;">
      <tbody>
        <tr><td class="lbl" style="width:40%;background:#F7F8FA;font-weight:600;">Total de formandos inscritos</td><td>${trainees.length}</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Total de sessões realizadas</td><td>${sessions.length}</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Taxa de presença global</td><td><strong>${presenceRate}%</strong> (${totalPresent}/${totalPossible})</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Aprovados</td><td>${passed}</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Reprovados</td><td>${failed}</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Em curso / sem avaliação</td><td>${inProgress}</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Ocorrências registadas</td><td>${occurrences.length}</td></tr>
      </tbody>
    </table>

    <h2>Síntese das Sessões</h2>
    <div style="border:1px solid #e0e0e0;padding:10px;font-size:10px;line-height:1.55;">
      ${esc(trainerSummary)}
    </div>

    <h2>Conclusões</h2>
    <div style="border:1px solid #e0e0e0;padding:10px;min-height:80px;font-size:10px;"></div>

    <div class="signature-area" style="margin-top:32px;">
      <div class="cell">
        <div class="label">Pelo(s) Formador(es)</div>
        <div class="area"></div>
        <div class="small">${esc(trainerNames)}</div>
      </div>
      <div class="cell">
        <div class="label">Pelo Coordenador Pedagógico</div>
        <div class="area"></div>
        <div class="small">${esc(tenant?.name)}</div>
      </div>
    </div>
  `;
  return pageShell("Relatório Final do Curso", body);
}
