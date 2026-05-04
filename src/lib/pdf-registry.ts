// Registry central de templates DGERT.
// Cada entrada mapeia um docType para a função render que devolve HTML.
// O segundo argumento (sub-id) é opcional e usado para FICHA/CONTRATO/AVALIACAO/
// JUSTIFICACAO (passa-se traineeId) e PLANO (passa-se sessionId).

import type { ActionPDFData, CertificatePDFData } from "@/templates/pdf/index";
import { renderCapa } from "@/templates/pdf/Capa";
import { renderEquipaFormativa } from "@/templates/pdf/EquipaFormativa";
import { renderProgramaFormacao } from "@/templates/pdf/ProgramaFormacao";
import { renderPlanoSessao } from "@/templates/pdf/PlanoSessao";
import { renderFichaIdentificacao } from "@/templates/pdf/FichaIdentificacao";
import { renderContratoEntidade } from "@/templates/pdf/ContratoFormacaoEntidadeCliente";
import { renderContratoFormando } from "@/templates/pdf/ContratoFormacaoFormando";
import { renderContratoFormador } from "@/templates/pdf/ContratoPrestacaoServicosFormador";
import { renderRegistoSumarios } from "@/templates/pdf/RegistoSumarios";
import { renderFolhaPresencas } from "@/templates/pdf/FolhaPresencas";
import { renderAvaliacaoAprendizagem } from "@/templates/pdf/AvaliacaoAprendizagemFormando";
import { renderRegistoOcorrencias } from "@/templates/pdf/FichaRegistoOcorrencias";
import { renderJustificacaoFalta } from "@/templates/pdf/JustificacaoFalta";
import { renderRelatorioFinal } from "@/templates/pdf/RelatorioFinalCurso";
import { renderComprovativoEntrega } from "@/templates/pdf/ComprovativoEntrega";
import { renderAtaReuniao } from "@/templates/pdf/AtaReuniaoPedagogica";
import { renderFichaAcao } from "@/templates/pdf/FichaAcao";
import { renderContratoPrestacao } from "@/templates/pdf/ContratoPrestacaoServicosFormacaoProfissional";
import { renderCertificado } from "@/templates/pdf/Certificado";

export type ActionRenderer = (data: ActionPDFData, subId?: string) => string;
export type CertRenderer = (data: CertificatePDFData) => string;

export const ACTION_RENDERERS: Record<string, { renderer: ActionRenderer; landscape?: boolean; nameSlug: string }> = {
  CAPA:                       { renderer: renderCapa,                   nameSlug: "00-capa" },
  EQUIPA_FORMATIVA:           { renderer: renderEquipaFormativa,        nameSlug: "01-equipa-formativa" },
  PROGRAMA_FORMACAO:          { renderer: renderProgramaFormacao,       nameSlug: "02-programa-formacao" },
  PLANO_SESSAO:               { renderer: renderPlanoSessao,            nameSlug: "03-plano-sessao" },
  FICHA_IDENTIFICACAO:        { renderer: renderFichaIdentificacao,     nameSlug: "05-ficha-identificacao" },
  CONTRATO_ENTIDADE:          { renderer: renderContratoEntidade,       nameSlug: "06-contrato-entidade" },
  CONTRATO_FORMANDO:          { renderer: renderContratoFormando,       nameSlug: "07-contrato-formando" },
  CONTRATO_FORMADOR:          { renderer: renderContratoFormador,       nameSlug: "08-contrato-formador" },
  REGISTO_SUMARIOS:           { renderer: renderRegistoSumarios,        nameSlug: "09-registo-sumarios" },
  REGISTO_PRESENCAS:          { renderer: renderFolhaPresencas,         landscape: true, nameSlug: "10-folha-presencas" },
  AVALIACAO_APRENDIZAGEM:     { renderer: renderAvaliacaoAprendizagem,  nameSlug: "11-avaliacao-aprendizagem" },
  REGISTO_OCORRENCIAS:        { renderer: renderRegistoOcorrencias,     nameSlug: "16-registo-ocorrencias" },
  JUSTIFICACAO_FALTA:         { renderer: renderJustificacaoFalta,      nameSlug: "17-justificacao-falta" },
  RELATORIO_FINAL:            { renderer: renderRelatorioFinal,         nameSlug: "18-relatorio-final" },
  COMPROVATIVO_ENTREGA:       { renderer: renderComprovativoEntrega,    nameSlug: "19-comprovativo-entrega" },
  ATA_REUNIAO:                { renderer: renderAtaReuniao,             nameSlug: "20-ata-reuniao" },
  FICHA_ACAO:                 { renderer: renderFichaAcao,              nameSlug: "21-ficha-acao" },
  CONTRATO_PRESTACAO:         { renderer: renderContratoPrestacao,      nameSlug: "22-contrato-prestacao" },
};

// Ordem oficial do dossier DGERT (nº docs)
export const DOSSIER_ORDER: string[] = [
  "CAPA",
  "EQUIPA_FORMATIVA",
  "PROGRAMA_FORMACAO",
  "PLANO_SESSAO",
  "FICHA_IDENTIFICACAO",  // Doc 5 — uma por formando (será iterado)
  "CONTRATO_ENTIDADE",
  "CONTRATO_FORMANDO",    // Doc 7 — uma por formando
  "CONTRATO_FORMADOR",    // Doc 8 — um por formador
  "REGISTO_SUMARIOS",
  "REGISTO_PRESENCAS",
  "AVALIACAO_APRENDIZAGEM", // Doc 11 — uma por formando
  "REGISTO_OCORRENCIAS",
  "JUSTIFICACAO_FALTA",     // Doc 17 — uma por formando
  "RELATORIO_FINAL",
  "ATA_REUNIAO",
  "FICHA_ACAO",
  "COMPROVATIVO_ENTREGA",
  "CONTRATO_PRESTACAO",
];

export const PER_TRAINEE_DOCS = new Set([
  "FICHA_IDENTIFICACAO",
  "CONTRATO_FORMANDO",
  "AVALIACAO_APRENDIZAGEM",
  "JUSTIFICACAO_FALTA",
]);

export const PER_TRAINER_DOCS = new Set([
  "CONTRATO_FORMADOR",
]);

export const CERTIFICATE_RENDERER = renderCertificado;
export { renderCertificado };
