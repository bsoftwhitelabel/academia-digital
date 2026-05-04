import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { WHATSAPP_TEMPLATES } from "@/lib/whatsapp-templates";
import { EnrollmentConfirmed } from "@/emails/EnrollmentConfirmed";
import { SessionReminder } from "@/emails/SessionReminder";
import { SignatureEnabled } from "@/emails/SignatureEnabled";
import { CertificateIssued } from "@/emails/CertificateIssued";
import { QuestionnaireAvailable } from "@/emails/QuestionnaireAvailable";
import type { NotificationEvent } from "@prisma/client";

export type NotificationData = Record<string, any>;

export type SendNotificationInput = {
  event: NotificationEvent;
  traineeId: string;
  data: NotificationData;
  tenantId: string;
};

type Built = {
  email?: { subject: string; template: any; props: any };
  whatsapp?: string;
};

function eventToWhatsAppKey(event: NotificationEvent): keyof typeof WHATSAPP_TEMPLATES | null {
  switch (event) {
    case "SESSION_REMINDER_24H":
    case "SESSION_REMINDER_2H":
      return "LEMBRETE_SESSAO";
    case "SIGNATURE_ENABLED":
      return "ASSINATURA_DISPONIVEL";
    case "CERTIFICATE_ISSUED":
      return "CERTIFICADO_EMITIDO";
    case "QUESTIONNAIRE_AVAILABLE":
      return "LINK_QUESTIONARIO";
    default:
      return null;
  }
}

/**
 * Construir payload (email + whatsapp body) para um evento.
 * Espera que `data` contenha as variáveis necessárias para o template.
 */
function buildPayload(
  event: NotificationEvent,
  data: NotificationData,
  ctx: { tenantNome: string; tenantLogoUrl: string | null; appUrl: string; nomeFormando: string }
): Built {
  const built: Built = {};
  switch (event) {
    case "ENROLLMENT_CONFIRMED":
      built.email = {
        subject: `Inscrição confirmada — ${data.cursoNome}`,
        template: EnrollmentConfirmed,
        props: {
          formandoNome: ctx.nomeFormando,
          cursoNome: data.cursoNome,
          dataInicio: data.dataInicio,
          dataFim: data.dataFim,
          local: data.local,
          tenantNome: ctx.tenantNome,
          tenantLogoUrl: ctx.tenantLogoUrl,
          appUrl: ctx.appUrl,
        },
      };
      // Sem template WhatsApp para inscrição confirmada
      break;

    case "SESSION_REMINDER_24H":
    case "SESSION_REMINDER_2H":
      built.email = {
        subject: `Lembrete: a sua sessão é amanhã — ${data.cursoNome}`,
        template: SessionReminder,
        props: {
          formandoNome: ctx.nomeFormando,
          cursoNome: data.cursoNome,
          data: data.data,
          horaInicio: data.horaInicio,
          horaFim: data.horaFim,
          local: data.local,
          sessionId: data.sessionId,
          tenantNome: ctx.tenantNome,
          tenantLogoUrl: ctx.tenantLogoUrl,
          appUrl: ctx.appUrl,
        },
      };
      built.whatsapp = WHATSAPP_TEMPLATES.LEMBRETE_SESSAO({
        nome: ctx.nomeFormando,
        curso: data.cursoNome,
        data: data.data,
        horaInicio: data.horaInicio,
        horaFim: data.horaFim,
        local: data.local,
        linkCheckin: `${ctx.appUrl.replace(/\/$/, "")}/trainee/checkin/${data.sessionId}`,
        nomeTenant: ctx.tenantNome,
      });
      break;

    case "SIGNATURE_ENABLED":
      built.email = {
        subject: `Assinatura disponível — ${data.cursoNome}`,
        template: SignatureEnabled,
        props: {
          formandoNome: ctx.nomeFormando,
          cursoNome: data.cursoNome,
          sessaoData: data.sessaoData,
          documentId: data.documentId,
          expiresAt: data.expiresAt ?? null,
          notes: data.notes ?? null,
          tenantNome: ctx.tenantNome,
          tenantLogoUrl: ctx.tenantLogoUrl,
          appUrl: ctx.appUrl,
        },
      };
      built.whatsapp = WHATSAPP_TEMPLATES.ASSINATURA_DISPONIVEL({
        nome: ctx.nomeFormando,
        curso: data.cursoNome,
        linkAssinatura: `${ctx.appUrl.replace(/\/$/, "")}/trainee/sign/${data.documentId}`,
        expiracao: data.expiresAt ?? "—",
        nomeTenant: ctx.tenantNome,
      });
      break;

    case "CERTIFICATE_ISSUED":
      built.email = {
        subject: `O seu certificado está pronto — ${data.cursoNome}`,
        template: CertificateIssued,
        props: {
          formandoNome: ctx.nomeFormando,
          cursoNome: data.cursoNome,
          dataConclusao: data.dataConclusao,
          certificateId: data.certificateId,
          pdfUrl: data.pdfUrl,
          verificationCode: data.verificationCode,
          qrDataUrl: data.qrDataUrl ?? null,
          tenantNome: ctx.tenantNome,
          tenantLogoUrl: ctx.tenantLogoUrl,
        },
      };
      built.whatsapp = WHATSAPP_TEMPLATES.CERTIFICADO_EMITIDO({
        nome: ctx.nomeFormando,
        curso: data.cursoNome,
        linkCertificado: data.pdfUrl,
        nomeTenant: ctx.tenantNome,
      });
      break;

    case "QUESTIONNAIRE_AVAILABLE":
      built.email = {
        subject: `Avalie a formação — ${data.cursoNome}`,
        template: QuestionnaireAvailable,
        props: {
          formandoNome: ctx.nomeFormando,
          cursoNome: data.cursoNome,
          linkSurvey: data.linkSurvey,
          tenantNome: ctx.tenantNome,
          tenantLogoUrl: ctx.tenantLogoUrl,
        },
      };
      built.whatsapp = WHATSAPP_TEMPLATES.LINK_QUESTIONARIO({
        nome: ctx.nomeFormando,
        curso: data.cursoNome,
        linkSurvey: data.linkSurvey,
        nomeTenant: ctx.tenantNome,
      });
      break;

    default:
      // Outros eventos (CHECKIN_AVAILABLE, INQUIRY_RECEIVED, SESSION_CLOSED) — sem template default aqui
      break;
  }
  return built;
}

/**
 * Envia notificação multi-canal a um formando (email + WhatsApp se aplicável).
 *
 * Lê preferências em User (notifEmail, notifWhatsApp) e configuração do tenant
 * em `Tenant.notifConfig.whatsapp.events.*` para decidir cada canal.
 *
 * Não rebenta o fluxo principal — captura erros silenciosamente.
 */
export async function sendNotification(input: SendNotificationInput): Promise<void> {
  const trainee = await prisma.trainee.findUnique({
    where: { id: input.traineeId },
    include: { user: true },
  });
  if (!trainee) {
    console.warn("[notifications] Trainee não encontrado:", input.traineeId);
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: {
      name: true,
      logoUrl: true,
      notifConfig: true,
    },
  });

  const tenantNome = tenant?.name ?? "Academia Digital";
  const tenantLogoUrl = tenant?.logoUrl ?? null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const nomeFormando = `${trainee.firstName} ${trainee.lastName}`.trim();

  const built = buildPayload(input.event, input.data, {
    tenantNome,
    tenantLogoUrl,
    appUrl,
    nomeFormando,
  });

  // Preferências do utilizador
  const wantsEmail = trainee.user?.notifEmail !== false; // default true
  const wantsWhats = trainee.user?.notifWhatsApp !== false; // default true
  const phone = trainee.user?.phone || trainee.phone;
  const recipient = trainee.user?.email || trainee.email;

  // Configuração do tenant para WhatsApp
  const cfg = (tenant?.notifConfig as any) || {};
  const wpCfg = cfg.whatsapp || {};
  const wpTenantEnabled = wpCfg.enabled !== false; // default true
  const wpKey = eventToWhatsAppKey(input.event);
  const eventsCfg = wpCfg.events || {};
  // Mapping evento → key na config (inclui SESSION_REMINDER_24H → SESSION_REMINDER)
  const eventKey =
    input.event === "SESSION_REMINDER_24H" || input.event === "SESSION_REMINDER_2H"
      ? "SESSION_REMINDER"
      : input.event;
  const wpEventEnabled = eventsCfg[eventKey] !== false; // default true

  // EMAIL ─────────────────────────────────────────────
  if (wantsEmail && built.email && recipient) {
    try {
      await sendEmail({
        to: recipient,
        subject: built.email.subject,
        template: built.email.template,
        data: built.email.props,
        tenantId: input.tenantId,
        event: input.event,
        meta: { traineeId: trainee.id },
      });
    } catch (e) {
      console.error("[notifications] sendEmail falhou:", e);
    }
  }

  // WHATSAPP ──────────────────────────────────────────
  if (
    wantsWhats &&
    phone &&
    built.whatsapp &&
    wpKey &&
    wpTenantEnabled &&
    wpEventEnabled
  ) {
    try {
      await sendWhatsApp({
        to: phone,
        country: trainee.country || "PT",
        body: built.whatsapp,
        tenantId: input.tenantId,
        event: input.event,
        meta: { traineeId: trainee.id },
      });
    } catch (e) {
      console.error("[notifications] sendWhatsApp falhou:", e);
    }
  }
}
