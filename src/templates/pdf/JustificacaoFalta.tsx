import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

export function renderJustificacaoFalta(data: ActionPDFData, traineeId?: string): string {
  const { action, tenant, trainees, logos } = data;
  const t = (traineeId && trainees.find((x: any) => x.id === traineeId)) || trainees[0];
  if (!t) return pageShell("Justificação", "<p>Sem formando.</p>");

  // Sessões em que NÃO há check-in para este formando
  const sessions = (action.sessions || []) as any[];
  const presentSessionIds = new Set(
    (t.checkIns || []).filter((c: any) => c.status !== "ABSENT").map((c: any) => c.sessionId)
  );
  const absent = sessions.filter((s) => !presentSessionIds.has(s.id));

  const fullName = `${esc(t.firstName)} ${esc(t.lastName)}`.trim();

  const rows = absent.length
    ? absent
        .map(
          (s, i) => `<tr>
            <td style="text-align:center;width:24px;">${i + 1}</td>
            <td style="width:90px;">${esc(fmtDate(s.sessionDate))}</td>
            <td style="width:90px;">${esc(s.startTime)} – ${esc(s.endTime)}</td>
            <td><span class="empty-line" style="min-width:300px;"></span></td>
            <td style="width:120px;"><span class="empty-line" style="min-width:100px;"></span></td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#999;padding:14px;">Sem faltas — todas as sessões com presença confirmada.</td></tr>`;

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Justificação de Falta", "17")}
    <table class="meta">
      <tr><td class="lbl">Formando</td><td>${fullName}</td></tr>
      <tr><td class="lbl">Curso</td><td>${esc(action.course?.name)}</td></tr>
      <tr><td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td></tr>
    </table>
    <h2>Faltas a Justificar</h2>
    <table class="data">
      <thead>
        <tr>
          <th style="width:24px;">Nº</th>
          <th style="width:90px;">Data</th>
          <th style="width:90px;">Horário</th>
          <th>Motivo / Justificação</th>
          <th style="width:120px;">Doc. anexa</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="signature-area" style="margin-top:24px;">
      <div class="cell">
        <div class="label">Assinatura do Formando</div>
        <div class="area"></div>
        <div class="small">${fullName}</div>
      </div>
      <div class="cell">
        <div class="label">Assinatura do Formador</div>
        <div class="area"></div>
      </div>
    </div>
  `;
  return pageShell("Justificação de Falta", body);
}
