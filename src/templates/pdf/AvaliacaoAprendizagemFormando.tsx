import type { ActionPDFData } from "./index";
import { renderHeader, esc, pageShell, findSignature } from "./base/DocumentHeader";

const CRITERIOS = [
  { key: "conhecimentos", label: "Aquisição de conhecimentos" },
  { key: "aplicacao", label: "Aplicação prática" },
  { key: "participacao", label: "Participação e empenho" },
  { key: "trabalho_equipa", label: "Trabalho em equipa" },
  { key: "assiduidade", label: "Assiduidade e pontualidade" },
];

export function renderAvaliacaoAprendizagem(data: ActionPDFData, traineeId?: string): string {
  const { action, tenant, trainees, logos } = data;
  const t = (traineeId && trainees.find((x: any) => x.id === traineeId)) || trainees[0];
  if (!t) return pageShell("Avaliação", "<p>Sem formando.</p>");

  const fullName = `${esc(t.firstName)} ${esc(t.lastName)}`.trim();
  const isQuant = !!action.course?.quantitativeEvaluation;
  // Escala
  const scale = isQuant ? [1, 2, 3, 4, 5] : ["Excelente", "Bom", "Suficiente", "Insuficiente"];

  const grid = CRITERIOS.map(
    (c, i) => `<tr>
      <td style="text-align:center;width:24px;">${i + 1}</td>
      <td>${esc(c.label)}</td>
      ${scale.map(() => `<td style="text-align:center;width:60px;">☐</td>`).join("")}
    </tr>`
  ).join("");

  const sig = findSignature(t.signatures, "AVALIACAO_FORMANDO");

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Avaliação da Aprendizagem", "11")}
    <table class="meta">
      <tr><td class="lbl">Formando</td><td colspan="3">${fullName}</td></tr>
      <tr>
        <td class="lbl">Curso</td><td>${esc(action.course?.name)}</td>
        <td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Tipo de avaliação</td>
        <td colspan="3">${isQuant ? "Quantitativa (escala 1–5)" : "Qualitativa"}</td>
      </tr>
    </table>
    <h2>Grelha de Avaliação</h2>
    <table class="data">
      <thead>
        <tr>
          <th style="width:24px;">Nº</th>
          <th>Critério</th>
          ${scale.map((s) => `<th style="text-align:center;width:60px;">${esc(s)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${grid}</tbody>
    </table>
    <h2>Nota Final</h2>
    <table class="meta">
      <tr>
        <td class="lbl">${isQuant ? "Nota numérica (0-20)" : "Classificação final"}</td>
        <td><span class="empty-line"></span></td>
        <td class="lbl">Aprovado</td><td>☐ Sim &nbsp; ☐ Não</td>
      </tr>
    </table>
    <h2>Observações do Formador</h2>
    <div style="border:1px solid #e0e0e0;padding:10px;min-height:60px;"></div>
    <div class="signature-area" style="margin-top:24px;">
      <div class="cell">
        <div class="label">Assinatura do Formando</div>
        <div class="area">
          ${sig ? `<img class="sig" src="${esc(sig)}" alt="Assinatura ${fullName}" />` : ""}
        </div>
        <div class="small">${fullName}</div>
      </div>
      <div class="cell">
        <div class="label">Assinatura do Formador</div>
        <div class="area"></div>
      </div>
    </div>
  `;
  return pageShell("Avaliação da Aprendizagem", body);
}
