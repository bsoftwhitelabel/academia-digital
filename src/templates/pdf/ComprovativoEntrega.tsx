import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

const DOCS = [
  ["0", "Capa do Dossier"],
  ["1", "Equipa Formativa"],
  ["2", "Programa de Formação"],
  ["3", "Plano de Sessão"],
  ["5", "Ficha de Identificação"],
  ["6", "Contrato — Entidade Cliente"],
  ["7", "Contrato — Formando"],
  ["8", "Contrato — Formador"],
  ["9", "Registo de Sumários"],
  ["10", "Registo de Presenças"],
  ["11", "Avaliação da Aprendizagem"],
  ["16", "Registo de Ocorrências"],
  ["17", "Justificação de Falta"],
  ["18", "Relatório Final"],
  ["20", "Ata de Reunião Pedagógica"],
  ["21", "Ficha da Ação"],
];

export function renderComprovativoEntrega(data: ActionPDFData): string {
  const { action, tenant, logos } = data;

  const rows = DOCS.map(
    ([n, t]) => `<tr>
      <td style="text-align:center;width:60px;font-family:monospace;">${esc(n)}</td>
      <td>${esc(t)}</td>
      <td style="text-align:center;width:60px;">☐</td>
    </tr>`
  ).join("");

  const today = fmtDate(new Date());

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Comprovativo de Entrega", "19")}

    <p style="font-size:10px;line-height:1.55;color:#333;margin:6px 0 12px;">
      Confirma-se a entrega do Dossier Técnico-Pedagógico relativo à ação de formação abaixo identificada,
      contendo os documentos assinalados.
    </p>

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
        <td class="lbl">Data de entrega</td><td>${esc(today)}</td>
        <td class="lbl">N.º docs entregues</td><td><span class="empty-line" style="min-width:60px;"></span></td>
      </tr>
    </table>

    <h2>Documentos Entregues</h2>
    <table class="data">
      <thead>
        <tr>
          <th style="width:60px;text-align:center;">Doc</th>
          <th>Descrição</th>
          <th style="width:60px;text-align:center;">✓</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="signature-area" style="margin-top:36px;">
      <div class="cell">
        <div class="label">Entregue por (Responsável de Formação)</div>
        <div class="area"></div>
        <div class="small">${esc(tenant?.name)}</div>
      </div>
      <div class="cell">
        <div class="label">Recebido por</div>
        <div class="area"></div>
        <div class="small">${esc(action.clientOrg?.name || "—")}</div>
      </div>
    </div>
  `;
  return pageShell("Comprovativo de Entrega", body);
}
