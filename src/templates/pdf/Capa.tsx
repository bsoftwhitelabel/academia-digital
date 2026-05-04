import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

const INDEX = [
  ["0", "Capa"],
  ["1", "Equipa Formativa"],
  ["2", "Programa de Formação"],
  ["3", "Plano de Sessão"],
  ["5", "Ficha de Identificação"],
  ["6", "Contrato de Formação — Entidade Cliente"],
  ["7", "Contrato de Formação — Formando"],
  ["8", "Contrato de Prestação de Serviços — Formador"],
  ["9", "Registo de Sumários"],
  ["10", "Registo de Presenças"],
  ["11", "Avaliação da Aprendizagem"],
  ["16", "Ficha de Registo de Ocorrências"],
  ["17", "Justificação de Falta"],
  ["18", "Relatório Final do Curso"],
  ["19", "Comprovativo de Entrega"],
  ["20", "Ata de Reunião Pedagógica"],
  ["21", "Ficha da Ação"],
  ["22", "Contrato de Prestação de Serviços de Formação"],
];

export function renderCapa(data: ActionPDFData): string {
  const { action, tenant, logos } = data;
  const trainerNames =
    (action.trainers || [])
      .map((t: any) => `${t.trainer?.user?.firstName || ""} ${t.trainer?.user?.lastName || ""}`.trim())
      .filter(Boolean)
      .join(", ") || "—";

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null)}

    <div style="margin-top:60px;text-align:center;">
      <div style="font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;">Dossier Técnico-Pedagógico</div>
      <h1 style="color:#0B2447;font-size:32px;margin:18px 0 6px;letter-spacing:1px;">${esc(action.course?.name || "—")}</h1>
      <div style="height:2px;width:120px;background:#C9A520;margin:0 auto 16px;"></div>
      <div style="font-size:14px;color:#444;">${esc(action.actionCode || action.actionNumber || action.id.slice(0, 8))}</div>
    </div>

    <table class="meta" style="margin-top:46px;">
      <tr><td class="lbl">Entidade Formadora</td><td>${esc(tenant?.name || "—")}</td></tr>
      <tr><td class="lbl">Entidade Cliente</td><td>${esc(action.clientOrg?.name || "—")}</td></tr>
      <tr><td class="lbl">Modalidade</td><td>${esc(action.format)}</td></tr>
      <tr><td class="lbl">Período</td><td>${esc(fmtDate(action.startDate))} a ${esc(fmtDate(action.endDate))}</td></tr>
      <tr><td class="lbl">Duração</td><td>${esc(action.course?.durationHours ?? "—")} horas</td></tr>
      <tr><td class="lbl">Local</td><td>${esc(action.room?.name || (action.format === "ELEARNING" ? "E-learning" : "—"))}</td></tr>
      <tr><td class="lbl">Formador(es)</td><td>${esc(trainerNames)}</td></tr>
    </table>

    <h2 style="margin-top:32px;">Índice do Dossier</h2>
    <table class="data">
      <thead><tr><th style="width:8%;">Doc</th><th>Documento</th></tr></thead>
      <tbody>
        ${INDEX.map(([n, t]) => `<tr><td style="text-align:center;font-family:monospace;">${esc(n)}</td><td>${esc(t)}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
  return pageShell("Capa do Dossier", body);
}
