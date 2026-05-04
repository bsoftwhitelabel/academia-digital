import type { ActionPDFData } from "./index";
import { renderHeader, esc, pageShell, findSignature } from "./base/DocumentHeader";

export function renderEquipaFormativa(data: ActionPDFData): string {
  const { action, tenant, logos } = data;
  const trainers = (action.trainers || []) as any[];

  const rows = trainers.length
    ? trainers
        .map((t, i) => {
          const tr = t.trainer || {};
          const u = tr.user || {};
          const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
          const role = t.role === "MAIN" ? "Principal" : t.role === "ASSISTANT" ? "Assistente" : t.role || "—";
          const areas = (tr.trainingAreas || []).map((a: any) => a.name).join(", ") || "—";
          const sig = findSignature(tr.signatures, "CONTRATO_FORMADOR");
          return `<tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${esc(fullName)}</td>
            <td>${esc(tr.ccpNumber || "—")}</td>
            <td>${esc(areas)}</td>
            <td>${esc(role)}</td>
            <td style="width:160px;text-align:center;">
              ${sig ? `<img src="${esc(sig)}" style="max-height:32px;max-width:140px;" />` : '<div style="border-bottom:1px solid #999;height:24px;"></div>'}
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" style="text-align:center;color:#999;padding:14px;">Sem formadores atribuídos.</td></tr>`;

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Equipa Formativa", "1")}
    <table class="meta">
      <tr>
        <td class="lbl">Curso</td><td>${esc(action.course?.name)}</td>
        <td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td>
      </tr>
    </table>
    <h2>Formadores</h2>
    <table class="data">
      <thead>
        <tr>
          <th style="width:24px;">Nº</th>
          <th>Nome</th>
          <th>CCP</th>
          <th>Áreas de Formação</th>
          <th>Função</th>
          <th>Assinatura</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  return pageShell("Equipa Formativa", body);
}
