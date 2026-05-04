import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell, findSignature } from "./base/DocumentHeader";

export function renderContratoFormador(data: ActionPDFData, trainerId?: string): string {
  const { action, tenant, logos } = data;
  const trainers = (action.trainers || []) as any[];
  const target = trainerId ? trainers.find((t) => t.trainerId === trainerId) : trainers[0];
  if (!target) return pageShell("Contrato Formador", "<p>Sem formadores.</p>");

  const tr = target.trainer || {};
  const u = tr.user || {};
  const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
  const sig = findSignature(tr.signatures, "CONTRATO_FORMADOR");

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Contrato de Prestação de Serviços — Formador", "8")}
    <h2>Identificação do Formador</h2>
    <table class="meta">
      <tr><td class="lbl">Nome</td><td colspan="3">${esc(fullName)}</td></tr>
      <tr>
        <td class="lbl">CCP</td><td>${esc(tr.ccpNumber || "—")}</td>
        <td class="lbl">e-Formador</td><td>${tr.eTrainer ? "Sim" : "Não"}</td>
      </tr>
      <tr>
        <td class="lbl">Email</td><td>${esc(u.email || "—")}</td>
        <td class="lbl">Externo</td><td>${tr.isExternal ? "Sim" : "Não"}</td>
      </tr>
      <tr>
        <td class="lbl">Anos PRES</td><td>${esc(tr.yearsExperiencePresential ?? 0)}</td>
        <td class="lbl">Anos EAD</td><td>${esc(tr.yearsExperienceDistance ?? 0)}</td>
      </tr>
    </table>
    <h2>Ação de Formação</h2>
    <table class="meta">
      <tr><td class="lbl">Curso</td><td colspan="3">${esc(action.course?.name)}</td></tr>
      <tr>
        <td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td>
        <td class="lbl">Função</td><td>${esc(target.role === "MAIN" ? "Principal" : "Assistente")}</td>
      </tr>
      <tr>
        <td class="lbl">Período</td><td>${esc(fmtDate(action.startDate))} a ${esc(fmtDate(action.endDate))}</td>
        <td class="lbl">Duração</td><td>${esc(action.course?.durationHours ?? "—")} h</td>
      </tr>
    </table>
    <h2>Condições de Pagamento</h2>
    <table class="meta">
      <tr><td class="lbl">Valor / hora</td><td>____________ €</td></tr>
      <tr><td class="lbl">Total estimado</td><td>____________ €</td></tr>
      <tr><td class="lbl">Forma de pagamento</td><td>Transferência bancária após emissão de recibo</td></tr>
      <tr><td class="lbl">Taxa IRS</td><td>${tr.vatRate ? `${tr.vatRate}%` : "____________ %"}</td></tr>
    </table>
    <p class="small" style="margin-top:8px;color:#666;">
      Os campos em branco serão preenchidos manualmente após acordo entre as partes.
    </p>
    <div class="signature-area" style="margin-top:32px;">
      <div class="cell">
        <div class="label">Assinatura do Formador</div>
        <div class="area">
          ${sig ? `<img class="sig" src="${esc(sig)}" alt="Assinatura ${esc(fullName)}" />` : ""}
        </div>
        <div class="small">${esc(fullName)}</div>
      </div>
      <div class="cell">
        <div class="label">Pela Entidade Formadora</div>
        <div class="area"></div>
        <div class="small">${esc(tenant?.name)}</div>
      </div>
    </div>
  `;
  return pageShell("Contrato — Formador", body);
}
