import { render } from "@react-email/render";
import { Resend } from "resend";
import * as React from "react";
import prisma from "@/lib/prisma";
import type {
  NotificationChannel,
  NotificationEvent,
} from "@prisma/client";

export type SendEmailInput<P> = {
  to: string;
  subject: string;
  template: React.ComponentType<P> | ((props: P) => React.ReactElement);
  data: P;
  tenantId: string;
  event: NotificationEvent;
  // Referências opcionais (para o NotificationLog)
  meta?: {
    traineeId?: string;
    trainerId?: string;
    sessionId?: string;
  };
};

const DEFAULT_FROM_NAME = "Academia Digital";
const DEFAULT_FROM_ADDRESS = "noreply@academiadigital.app";

let _resend: Resend | null = null;
function resendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

async function logNotification(args: {
  tenantId: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  status: "SENT" | "DELIVERED" | "BOUNCED" | "FAILED";
  errorMsg?: string | null;
  traineeId?: string;
  trainerId?: string;
  sessionId?: string;
}) {
  try {
    await prisma.notificationLog.create({
      data: {
        tenantId: args.tenantId,
        event: args.event,
        channel: args.channel,
        recipient: args.recipient,
        subject: args.subject,
        status: args.status,
        errorMsg: args.errorMsg ?? null,
        traineeId: args.traineeId ?? null,
        trainerId: args.trainerId ?? null,
        sessionId: args.sessionId ?? null,
      },
    });
  } catch (e) {
    console.error("[email] Failed to write NotificationLog:", e);
  }
}

/**
 * Envia um email transacional renderizado a partir de um template React.
 *
 * - Busca o Tenant para obter `emailFromAddress`/`emailFromName` e logo.
 * - Renderiza o template via `@react-email/render` para HTML + texto.
 * - Envia via Resend se `RESEND_API_KEY` estiver definida.
 * - Em modo dev (sem chave): regista no console o assunto + amostra do HTML.
 * - Cria um `NotificationLog` em todos os casos (SENT/FAILED).
 */
export async function sendEmail<P>(input: SendEmailInput<P>): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: {
      name: true,
      logoUrl: true,
      platformName: true,
      emailFromName: true,
      emailFromAddress: true,
    },
  });

  // Permite que o template aceda ao branding do tenant via props já injetadas
  // (cada template é responsável por aceitar tenantNome/tenantLogoUrl).
  const Template = input.template;
  const element = React.createElement(Template, input.data);

  let html: string;
  let text: string;
  try {
    const renderResult: any = render(element);
    if (renderResult && typeof renderResult.then === "function") {
      // @react-email/render v2 devolve Promise<string>
      html = await renderResult;
    } else {
      html = renderResult as string;
    }
    text = stripHtml(html);
  } catch (e: any) {
    console.error("[email] Falha a renderizar template:", e);
    await logNotification({
      tenantId: input.tenantId,
      event: input.event,
      channel: "EMAIL",
      recipient: input.to,
      subject: input.subject,
      status: "FAILED",
      errorMsg: `Render error: ${e?.message || String(e)}`,
      ...(input.meta || {}),
    });
    return;
  }

  const fromName =
    tenant?.emailFromName ?? tenant?.platformName ?? tenant?.name ?? DEFAULT_FROM_NAME;
  const fromAddress = tenant?.emailFromAddress ?? DEFAULT_FROM_ADDRESS;
  const from = `${fromName} <${fromAddress}>`;

  const client = resendClient();
  if (!client) {
    // Modo dev — não há chave: log e regista como SENT (simulado)
    console.log(
      `[email][dev] To=${input.to} Subject="${input.subject}" From=${from}\n` +
        `         Tenant=${tenant?.name ?? input.tenantId} Event=${input.event}\n` +
        `         HTML(${html.length} bytes), text(${text.length} bytes)`
    );
    await logNotification({
      tenantId: input.tenantId,
      event: input.event,
      channel: "EMAIL",
      recipient: input.to,
      subject: input.subject,
      status: "SENT",
      errorMsg: "[dev mode — RESEND_API_KEY not set]",
      ...(input.meta || {}),
    });
    return;
  }

  try {
    const result = await client.emails.send({
      from,
      to: [input.to],
      subject: input.subject,
      html,
      text,
    });
    if ((result as any)?.error) {
      throw new Error((result as any).error?.message || "Resend error");
    }
    await logNotification({
      tenantId: input.tenantId,
      event: input.event,
      channel: "EMAIL",
      recipient: input.to,
      subject: input.subject,
      status: "SENT",
      ...(input.meta || {}),
    });
  } catch (e: any) {
    console.error("[email] Resend send failed:", e);
    await logNotification({
      tenantId: input.tenantId,
      event: input.event,
      channel: "EMAIL",
      recipient: input.to,
      subject: input.subject,
      status: "FAILED",
      errorMsg: e?.message || String(e),
      ...(input.meta || {}),
    });
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
