import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

export function renderContratoEntidade(data: ActionPDFData): string {
  const { action, tenant, logos } = data;
  const co = action.clientOrg || {};

  const clauses = [
    "1ª — Objeto: O presente contrato tem por objeto a prestação de serviços de formação profissional pela Entidade Formadora à Entidade Cliente, conforme a ação identificada acima.",
    "2ª — Obrigações da Entidade Formadora: assegurar a execução do plano de formação, fornecer os meios pedagógicos necessários, manter o dossier técnico-pedagógico e emitir certificado de conclusão aos formandos com aproveitamento.",
    "3ª — Obrigações da Entidade Cliente: indicar os formandos, garantir a sua presença e cumprir os pagamentos previstos.",
    "4ª — Confidencialidade: ambas as partes obrigam-se a manter sigilo sobre a informação trocada no contexto desta formação.",
    "5ª — Foro: para todas as questões emergentes deste contrato é competente o foro da comarca da sede da Entidade Formadora, com renúncia expressa a qualquer outro.",
  ];

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", co.name || null, "Contrato de Formação — Entidade Cliente", "6")}
    <h2>Identificação das Partes</h2>
    <table class="meta">
      <tr><td class="lbl">Entidade Formadora</td><td>${esc(tenant?.name)}</td></tr>
      <tr><td class="lbl">DGERT</td><td>${esc(tenant?.dgertCode || "—")}</td></tr>
      <tr><td class="lbl">Entidade Cliente</td><td>${esc(co.name)}</td></tr>
      <tr><td class="lbl">NIF</td><td>${esc(co.nif || "—")}</td></tr>
      <tr><td class="lbl">Morada</td><td>${esc(co.address || "—")}, ${esc(co.postalCode || "")} ${esc(co.city || "")}</td></tr>
    </table>
    <h2>Ação de Formação</h2>
    <table class="meta">
      <tr><td class="lbl">Curso</td><td colspan="3">${esc(action.course?.name)}</td></tr>
      <tr>
        <td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td>
        <td class="lbl">Modalidade</td><td>${esc(action.format)}</td>
      </tr>
      <tr>
        <td class="lbl">Datas</td><td>${esc(fmtDate(action.startDate))} a ${esc(fmtDate(action.endDate))}</td>
        <td class="lbl">Duração</td><td>${esc(action.course?.durationHours ?? "—")} h</td>
      </tr>
    </table>
    <h2>Cláusulas</h2>
    <ol style="font-size:10px;line-height:1.55;color:#333;padding-left:18px;">
      ${clauses.map((c) => `<li style="margin-bottom:6px;">${esc(c)}</li>`).join("")}
    </ol>
    <div class="signature-area" style="margin-top:36px;">
      <div class="cell">
        <div class="label">Pela Entidade Cliente</div>
        <div class="area"></div>
        <div class="small">${esc(co.name)}</div>
      </div>
      <div class="cell">
        <div class="label">Pela Entidade Formadora</div>
        <div class="area"></div>
        <div class="small">${esc(tenant?.name)}</div>
      </div>
    </div>
  `;
  return pageShell("Contrato — Entidade Cliente", body);
}
