import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

export function renderFichaAcao(data: ActionPDFData): string {
  const { action, tenant, trainees, logos } = data;
  const sessions = (action.sessions || []) as any[];
  const enrolments = (action.enrollments || []) as any[];

  const totalPossible = trainees.length * sessions.length;
  let totalPresent = 0;
  for (const t of trainees) {
    totalPresent += ((t.checkIns || []) as any[]).filter((c) => c.status !== "ABSENT").length;
  }
  const presenceRate = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;

  const passed = enrolments.filter((e) => e.passed === true).length;
  const completed = enrolments.filter((e) => e.status === "COMPLETED").length;
  const completionRate = enrolments.length > 0 ? Math.round((completed / enrolments.length) * 100) : 0;
  const passRate = enrolments.length > 0 ? Math.round((passed / enrolments.length) * 100) : 0;

  const trainerNames =
    (action.trainers || [])
      .map((t: any) => `${t.trainer?.user?.firstName || ""} ${t.trainer?.user?.lastName || ""}`.trim())
      .filter(Boolean)
      .join(", ") || "—";

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Ficha da Ação", "21")}

    <h2>Dados Administrativos</h2>
    <table class="meta">
      <tr>
        <td class="lbl">Curso</td><td>${esc(action.course?.name)}</td>
        <td class="lbl">Código curso</td><td>${esc(action.course?.code || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Código ação</td><td>${esc(action.actionCode || "—")}</td>
        <td class="lbl">Nº ação</td><td>${esc(action.actionNumber || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Cliente</td><td>${esc(action.clientOrg?.name || "—")}</td>
        <td class="lbl">Plano</td><td>${esc(action.plan?.name || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Datas</td><td>${esc(fmtDate(action.startDate))} a ${esc(fmtDate(action.endDate))}</td>
        <td class="lbl">Duração</td><td>${esc(action.course?.durationHours ?? "—")} h</td>
      </tr>
      <tr>
        <td class="lbl">Modalidade</td><td>${esc(action.format)}</td>
        <td class="lbl">Local</td><td>${esc(action.room?.name || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Sistema financiamento</td><td>${esc(action.financingSystem || "—")}</td>
        <td class="lbl">Estado</td><td>${esc(action.status)}</td>
      </tr>
      <tr>
        <td class="lbl">Min. formandos</td><td>${esc(action.minTrainees ?? "—")}</td>
        <td class="lbl">Máx. formandos</td><td>${esc(action.maxTrainees ?? "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Formador(es)</td><td colspan="3">${esc(trainerNames)}</td>
      </tr>
    </table>

    <h2>Indicadores</h2>
    <table class="data" style="width:80%;">
      <tbody>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;width:50%;">Inscritos</td><td>${enrolments.length}</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Sessões</td><td>${sessions.length}</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Sessões fechadas</td><td>${sessions.filter((s) => s.isClosed).length}</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Taxa de presença</td><td><strong>${presenceRate}%</strong> (${totalPresent}/${totalPossible})</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Taxa de conclusão</td><td><strong>${completionRate}%</strong> (${completed}/${enrolments.length})</td></tr>
        <tr><td class="lbl" style="background:#F7F8FA;font-weight:600;">Taxa de aprovação</td><td><strong>${passRate}%</strong> (${passed}/${enrolments.length})</td></tr>
      </tbody>
    </table>

    <p class="small accent" style="margin-top:24px;text-align:center;">
      Documento gerado automaticamente em ${esc(fmtDate(new Date()))} para arquivo da ação.
    </p>
  `;
  return pageShell("Ficha da Ação", body);
}
