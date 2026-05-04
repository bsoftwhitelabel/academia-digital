import type { ActionPDFData } from "./index";
import { renderHeader, esc, fmtDate, pageShell } from "./base/DocumentHeader";

const CLAUSULAS = [
  "Cláusula 1ª (Objeto) — O presente contrato tem por objeto a prestação de serviços de formação profissional pela Primeira Outorgante (Entidade Formadora) à Segunda Outorgante (Entidade Cliente), nos termos e condições aqui acordados.",
  "Cláusula 2ª (Programa) — A formação a ministrar consta do programa em anexo, do qual fazem parte integrante: objetivos, conteúdos, metodologias, avaliação e cronograma.",
  "Cláusula 3ª (Duração e Local) — A formação decorrerá nas datas e locais identificados no Anexo I, podendo ser ajustados de comum acordo entre as partes.",
  "Cláusula 4ª (Valor) — O valor total da prestação é o indicado no Anexo II e será pago nos termos aí estabelecidos.",
  "Cláusula 5ª (Prazo de Pagamento) — Os pagamentos são feitos por transferência bancária no prazo de 30 dias após emissão de fatura, salvo acordo em contrário.",
  "Cláusula 6ª (Confidencialidade) — As partes obrigam-se a não divulgar a terceiros qualquer informação confidencial obtida no contexto da execução do presente contrato.",
  "Cláusula 7ª (RGPD) — O tratamento de dados pessoais dos formandos está sujeito ao Regulamento Geral de Proteção de Dados (UE 2016/679).",
  "Cláusula 8ª (Resolução) — Qualquer das partes pode resolver o contrato em caso de incumprimento grave da outra, mediante comunicação escrita com aviso prévio de 30 dias.",
  "Cláusula 9ª (Foro) — Para todas as questões emergentes deste contrato é competente o foro da comarca da sede da Primeira Outorgante.",
];

export function renderContratoPrestacao(data: ActionPDFData): string {
  const { action, tenant, logos } = data;
  const co = action.clientOrg || {};
  const today = fmtDate(new Date());

  const body = `
    ${renderHeader(logos, tenant?.name || "Academia Digital", co.name || null, "Contrato de Prestação de Serviços de Formação Profissional", "22")}

    <h2>Outorgantes</h2>
    <table class="meta">
      <tr>
        <td class="lbl">Primeira Outorgante</td>
        <td>${esc(tenant?.name)}, entidade formadora certificada DGERT (${esc(tenant?.dgertCode || "—")}), com sede em ${esc("—")}.</td>
      </tr>
      <tr>
        <td class="lbl">Segunda Outorgante</td>
        <td>${esc(co.name)}, NIF ${esc(co.nif || "—")}, com sede em ${esc(co.address || "—")}, ${esc(co.postalCode || "")} ${esc(co.city || "")}.</td>
      </tr>
    </table>

    <h2>Anexo I — Identificação da Ação</h2>
    <table class="meta">
      <tr>
        <td class="lbl">Curso</td><td>${esc(action.course?.name)}</td>
        <td class="lbl">Código</td><td>${esc(action.actionCode || "—")}</td>
      </tr>
      <tr>
        <td class="lbl">Datas</td><td>${esc(fmtDate(action.startDate))} a ${esc(fmtDate(action.endDate))}</td>
        <td class="lbl">Duração</td><td>${esc(action.course?.durationHours ?? "—")} h</td>
      </tr>
      <tr>
        <td class="lbl">Modalidade</td><td>${esc(action.format)}</td>
        <td class="lbl">Local</td><td>${esc(action.room?.name || "—")}</td>
      </tr>
    </table>

    <h2>Anexo II — Valor</h2>
    <table class="meta">
      <tr>
        <td class="lbl">Valor total</td><td><span class="empty-line" style="min-width:160px;"></span> €</td>
        <td class="lbl">IVA</td><td>☐ Isento &nbsp; ☐ Aplicável</td>
      </tr>
      <tr>
        <td class="lbl">Forma de pagamento</td>
        <td colspan="3"><span class="empty-line" style="min-width:300px;"></span></td>
      </tr>
    </table>

    <h2>Cláusulas</h2>
    <ol style="font-size:9.5px;line-height:1.55;color:#333;padding-left:18px;">
      ${CLAUSULAS.map((c) => `<li style="margin-bottom:6px;">${esc(c)}</li>`).join("")}
    </ol>

    <p class="small" style="margin-top:14px;">Feito em duplicado, em ${esc(today)}.</p>

    <div class="signature-area" style="margin-top:24px;">
      <div class="cell">
        <div class="label">Pela Primeira Outorgante</div>
        <div class="area"></div>
        <div class="small">${esc(tenant?.name)}</div>
      </div>
      <div class="cell">
        <div class="label">Pela Segunda Outorgante</div>
        <div class="area"></div>
        <div class="small">${esc(co.name)}</div>
      </div>
    </div>
  `;
  return pageShell("Contrato de Prestação", body);
}
