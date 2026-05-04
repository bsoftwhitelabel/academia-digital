import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell, findSignature } from "./base/DocumentHeader";

const CONDICOES = [
  "O formando obriga-se a frequentar a totalidade das sessões e a respeitar o regulamento interno da entidade formadora.",
  "A presença é obrigatória; faltas superiores a 10% da carga horária podem implicar reprovação na ação.",
  "A avaliação de aprendizagem é feita conforme o método previsto no programa de formação. O formando tem direito a conhecer e contestar a avaliação.",
  "A entidade formadora compromete-se a fornecer os meios pedagógicos necessários e a emitir certificado de conclusão aos formandos com aproveitamento.",
  "Os dados pessoais do formando são tratados nos termos da política RGPD da entidade formadora.",
];

export function renderContratoFormando(data: ActionPDFData, traineeId?: string): string {
  const { action, tenant, trainees, logos } = data;
  const t = (traineeId && trainees.find((x: any) => x.id === traineeId)) || trainees[0];
  if (!t) return pageShell("Contrato Formando", "<p>Sem formando.</p>");

  const sig = findSignature(t.signatures, "CONTRATO_FORMANDO") || findSignature(t.signatures, "FICHA_IDENTIFICACAO");
  const fullName = `${esc(t.firstName)} ${esc(t.lastName)}`.trim();

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Contrato de Formação — Formando", "7")}
    <h2>Identificação do Formando</h2>
    <table class="meta">
      <tr><td class="lbl">Nome</td><td colspan="3">${fullName}</td></tr>
      <tr>
        <td class="lbl">NIF</td><td>${esc(t.nif || "—")}</td>
        <td class="lbl">Nº BI/CC</td><td>${esc(t.idNumber || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Email</td><td>${esc(t.email)}</td>
        <td class="lbl">Telefone</td><td>${esc(t.phone || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Morada</td>
        <td colspan="3">${esc(t.address || "—")}, ${esc(t.postalCode || "")} ${esc(t.city || "")}</td>
      </tr>
    </table>
    <h2>Ação de Formação</h2>
    <table class="meta">
      <tr><td class="lbl">Curso</td><td colspan="3">${esc(action.course?.name)}</td></tr>
      <tr>
        <td class="lbl">Datas</td><td>${esc(fmtDate(action.startDate))} a ${esc(fmtDate(action.endDate))}</td>
        <td class="lbl">Duração</td><td>${esc(action.course?.durationHours ?? "—")} h</td>
      </tr>
      <tr>
        <td class="lbl">Modalidade</td><td>${esc(action.format)}</td>
        <td class="lbl">Local</td><td>${esc(action.room?.name || "—")}</td>
      </tr>
    </table>
    <h2>Condições de Frequência e Avaliação</h2>
    <ol style="font-size:10px;line-height:1.55;color:#333;padding-left:18px;">
      ${CONDICOES.map((c) => `<li style="margin-bottom:6px;">${esc(c)}</li>`).join("")}
    </ol>
    <div class="signature-area" style="margin-top:32px;">
      <div class="cell">
        <div class="label">Assinatura do Formando</div>
        <div class="area">
          ${sig ? `<img class="sig" src="${esc(sig)}" alt="Assinatura ${fullName}" />` : ""}
        </div>
        <div class="small">${fullName}</div>
      </div>
      <div class="cell">
        <div class="label">Pela Entidade Formadora</div>
        <div class="area"></div>
        <div class="small">${esc(tenant?.name)}</div>
      </div>
    </div>
  `;
  return pageShell("Contrato — Formando", body);
}
