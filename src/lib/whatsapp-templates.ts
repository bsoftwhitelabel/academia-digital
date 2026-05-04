// Templates de mensagens WhatsApp.
// Sandbox Twilio aceita texto livre; produção usará templates aprovados pela
// Meta (mesmas chaves, encaminhar via API com template approved name + vars).

export type LembreteSessaoVars = {
  nome: string;
  curso: string;
  data: string;             // dd/mm/yyyy
  horaInicio: string;
  horaFim: string;
  local: string;
  linkCheckin: string;
  nomeTenant: string;
};
export type AssinaturaVars = {
  nome: string;
  curso: string;
  linkAssinatura: string;
  expiracao: string;        // dd/mm/yyyy hh:mm
  nomeTenant: string;
};
export type CertificadoVars = {
  nome: string;
  curso: string;
  linkCertificado: string;
  nomeTenant: string;
};
export type QuestionarioVars = {
  nome: string;
  curso: string;
  linkSurvey: string;
  nomeTenant: string;
};

export const WHATSAPP_TEMPLATES = {
  LEMBRETE_SESSAO: ({
    nome, curso, data, horaInicio, horaFim, local, linkCheckin, nomeTenant,
  }: LembreteSessaoVars) =>
    `Olá ${nome}! Lembrete: a sua sessão de *${curso}* é amanhã, ${data} das ${horaInicio} às ${horaFim}.
Local: ${local}
Faça o check-in aqui: ${linkCheckin}
- ${nomeTenant}`,

  ASSINATURA_DISPONIVEL: ({
    nome, curso, linkAssinatura, expiracao, nomeTenant,
  }: AssinaturaVars) =>
    `Olá ${nome}! A sua assinatura para *${curso}* está disponível.
Assine aqui: ${linkAssinatura}
Válido até: ${expiracao}
- ${nomeTenant}`,

  CERTIFICADO_EMITIDO: ({
    nome, curso, linkCertificado, nomeTenant,
  }: CertificadoVars) =>
    `Parabéns ${nome}! O seu certificado de *${curso}* está pronto.
Descarregue aqui: ${linkCertificado}
- ${nomeTenant}`,

  LINK_QUESTIONARIO: ({
    nome, curso, linkSurvey, nomeTenant,
  }: QuestionarioVars) =>
    `Olá ${nome}! Por favor avalie a formação *${curso}*.
Demora apenas 2 minutos: ${linkSurvey}
Obrigado!
- ${nomeTenant}`,
};

export type WhatsAppTemplateKey = keyof typeof WHATSAPP_TEMPLATES;
