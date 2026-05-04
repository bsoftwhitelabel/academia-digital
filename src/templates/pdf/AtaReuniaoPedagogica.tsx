import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

export function renderAtaReuniao(data: ActionPDFData): string {
  const { action, tenant, logos } = data;
  const trainers = (action.trainers || []) as any[];

  const participantes = trainers.length
    ? trainers
        .map((t, i) => {
          const u = t.trainer?.user || {};
          return `<tr>
            <td style="text-align:center;width:24px;">${i + 1}</td>
            <td>${esc(`${u.firstName || ""} ${u.lastName || ""}`.trim() || "—")}</td>
            <td>${esc(t.role === "MAIN" ? "Formador Principal" : "Assistente")}</td>
            <td style="width:160px;text-align:center;">
              <div style="border-bottom:1px solid #999;height:22px;"></div>
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#999;padding:14px;">Sem participantes definidos.</td></tr>`;

  const today = fmtDate(new Date());

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", action.clientOrg?.name || null, "Ata de Reunião Pedagógica", "20")}

    <table class="meta">
      <tr>
        <td class="lbl">Curso</td><td>${esc(action.course?.name)}</td>
        <td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Data</td><td>${esc(today)}</td>
        <td class="lbl">Hora</td><td><span class="empty-line" style="min-width:80px;"></span></td>
      </tr>
      <tr>
        <td class="lbl">Local</td><td colspan="3">${esc(action.room?.name || tenant?.name || "—")}</td>
      </tr>
    </table>

    <h2>Participantes</h2>
    <table class="data">
      <thead>
        <tr><th style="width:24px;">Nº</th><th>Nome</th><th>Função</th><th style="width:160px;">Assinatura</th></tr>
      </thead>
      <tbody>${participantes}</tbody>
    </table>

    <h2>Ordem de Trabalhos</h2>
    <ol style="font-size:10px;line-height:1.7;color:#333;padding-left:18px;">
      <li>Análise do desenvolvimento da ação de formação até à data.</li>
      <li>Avaliação da participação e desempenho dos formandos.</li>
      <li>Identificação de eventuais ocorrências e ajustes necessários.</li>
      <li>Outros assuntos.</li>
    </ol>

    <h2>Deliberações e Conclusões</h2>
    <div style="border:1px solid #e0e0e0;padding:10px;min-height:140px;font-size:10px;line-height:1.55;"></div>

    <p class="small" style="margin-top:18px;">
      Nada mais havendo a tratar, foi encerrada a presente reunião. Da qual se lavrou a presente ata,
      assinada por todos os participantes.
    </p>
  `;
  return pageShell("Ata de Reunião Pedagógica", body);
}
