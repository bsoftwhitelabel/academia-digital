import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

export function renderRegistoOcorrencias(data: ActionPDFData): string {
  const { action, tenant, logos } = data;
  const occurrences = (action.occurrences || []) as any[];

  let inner: string;
  if (occurrences.length === 0) {
    inner = `
      <table class="data" style="margin-top:8px;">
        <thead>
          <tr>
            <th style="width:24px;">Nº</th>
            <th>Descrição</th>
            <th style="width:140px;">Assinatura do Formador</th>
            <th style="width:140px;">Assinatura do Responsável</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center;color:#bbb;">—</td>
            <td style="color:#999;font-style:italic;">Sem ocorrências nesta ação de formação.</td>
            <td><div style="border-bottom:1px solid #ccc;height:24px;"></div></td>
            <td><div style="border-bottom:1px solid #ccc;height:24px;"></div></td>
          </tr>
        </tbody>
      </table>
    `;
  } else {
    inner = `
      <table class="data" style="margin-top:8px;">
        <thead>
          <tr>
            <th style="width:24px;">Nº</th>
            <th style="width:80px;">Data</th>
            <th>Descrição</th>
            <th style="width:140px;">Form.</th>
            <th style="width:140px;">Resp.</th>
          </tr>
        </thead>
        <tbody>
          ${occurrences
            .map(
              (o, i) => `<tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${esc(fmtDate(o.occurredAt))}</td>
            <td>${esc(o.description)}</td>
            <td style="text-align:center;">
              ${o.trainerSignatureUrl ? `<img src="${esc(o.trainerSignatureUrl)}" style="max-height:30px;max-width:130px;" />` : '<div style="border-bottom:1px solid #999;height:22px;"></div>'}
            </td>
            <td style="text-align:center;">
              ${o.responsibleSignatureUrl ? `<img src="${esc(o.responsibleSignatureUrl)}" style="max-height:30px;max-width:130px;" />` : '<div style="border-bottom:1px solid #999;height:22px;"></div>'}
            </td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Ficha de Registo de Ocorrências", "16")}
    <table class="meta">
      <tr>
        <td class="lbl">Curso</td><td>${esc(action.course?.name)}</td>
        <td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td>
      </tr>
    </table>
    <h2>Ocorrências</h2>
    ${inner}
  `;
  return pageShell("Registo de Ocorrências", body);
}
