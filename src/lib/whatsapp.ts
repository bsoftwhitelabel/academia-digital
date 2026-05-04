import prisma from "@/lib/prisma";
import type { NotificationEvent } from "@prisma/client";

let _twilio: any = null;
function twilioClient(): any | null {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  if (!_twilio) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Twilio = require("twilio");
    _twilio = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return _twilio;
}

/**
 * Normaliza um número de telemóvel para formato Twilio WhatsApp.
 * Remove espaços, hífens, parênteses. Adiciona prefixo país se ausente.
 *
 * @param phone número original ("912345678", "+351 912 345 678", "21-1234567")
 * @param country país default ("PT" → +351, "BR" → +55, "ES" → +34)
 */
export function formatWhatsAppNumber(phone: string, country: string = "PT"): string {
  if (!phone) return "";
  // remover tudo o que não é dígito ou +
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("whatsapp:")) return cleaned;
  let withCountry = cleaned;
  if (!cleaned.startsWith("+")) {
    const map: Record<string, string> = { PT: "351", BR: "55", ES: "34", FR: "33", UK: "44" };
    const code = map[country.toUpperCase()] || "351";
    // Se começar com 00, substituir
    if (withCountry.startsWith("00")) withCountry = "+" + withCountry.slice(2);
    else withCountry = "+" + code + withCountry;
  }
  return `whatsapp:${withCountry}`;
}

export type SendWhatsAppInput = {
  to: string;                     // número original (formato livre)
  country?: string;               // PT/BR/etc
  body: string;                   // texto da mensagem (já renderizado)
  tenantId: string;
  event: NotificationEvent;
  meta?: { traineeId?: string; trainerId?: string; sessionId?: string };
};

/**
 * Envia mensagem WhatsApp. Em modo dev (sem TWILIO_ACCOUNT_SID), regista no
 * console e cria NotificationLog com flag de dev. Em produção, envia via Twilio
 * e regista o status real.
 */
export async function sendWhatsApp(input: SendWhatsAppInput): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { name: true },
  });

  const formatted = formatWhatsAppNumber(input.to, input.country);
  if (!formatted || formatted === "whatsapp:") {
    console.warn("[whatsapp] número inválido:", input.to);
    await logToDb({ ...input, recipient: input.to, status: "FAILED", errorMsg: "Número inválido" });
    return;
  }

  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
  const client = twilioClient();

  if (!client || !fromNumber) {
    console.log(
      `[whatsapp][dev] To=${formatted} Tenant=${tenant?.name ?? input.tenantId} Event=${input.event}\n` +
        `         BODY:\n${input.body}\n         (sem TWILIO_ACCOUNT_SID — mensagem não enviada)`
    );
    await logToDb({
      ...input,
      recipient: formatted,
      status: "SENT",
      errorMsg: "[dev mode — TWILIO_ACCOUNT_SID not set]",
    });
    return;
  }

  try {
    const result = await client.messages.create({
      from: fromNumber,
      to: formatted,
      body: input.body,
    });
    await logToDb({
      ...input,
      recipient: formatted,
      status: "SENT",
      providerMessageId: result?.sid ?? null,
    });
  } catch (e: any) {
    console.error("[whatsapp] Twilio error:", e?.message);
    await logToDb({
      ...input,
      recipient: formatted,
      status: "FAILED",
      errorMsg: e?.message || String(e),
    });
  }
}

async function logToDb(args: SendWhatsAppInput & {
  recipient: string;
  status: "SENT" | "FAILED" | "DELIVERED" | "BOUNCED";
  errorMsg?: string;
  providerMessageId?: string | null;
}) {
  try {
    await prisma.notificationLog.create({
      data: {
        tenantId: args.tenantId,
        event: args.event,
        channel: "WHATSAPP",
        recipient: args.recipient,
        status: args.status,
        errorMsg: args.errorMsg ?? null,
        traineeId: args.meta?.traineeId ?? null,
        trainerId: args.meta?.trainerId ?? null,
        sessionId: args.meta?.sessionId ?? null,
      },
    });
  } catch (e) {
    console.error("[whatsapp] Failed to write NotificationLog:", e);
  }
}
