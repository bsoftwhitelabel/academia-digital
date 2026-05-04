import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntegrationsClient, type IntegrationItem } from "./IntegrationsClient";
import { WhatsAppPanel } from "./WhatsAppPanel";
import { EmailPanel } from "./EmailPanel";
import { GoogleCalendarPanel } from "./GoogleCalendarPanel";

function maskValue(value: string | undefined): string {
  if (!value) return "";
  const tail = value.slice(-4);
  return "•".repeat(12) + tail;
}

const KEYS = [
  { key: "RESEND_API_KEY", label: "Resend (Email)" },
  { key: "R2_ACCESS_KEY_ID", label: "Cloudflare R2 — Access Key" },
  { key: "R2_SECRET_ACCESS_KEY", label: "Cloudflare R2 — Secret Key" },
  { key: "R2_ACCOUNT_ID", label: "Cloudflare R2 — Account ID" },
  { key: "TWILIO_ACCOUNT_SID", label: "Twilio (WhatsApp) — Account SID" },
  { key: "TWILIO_AUTH_TOKEN", label: "Twilio (WhatsApp) — Auth Token" },
];

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams?: { gcal?: string; reason?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "TENANT_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard");
  }

  const items: IntegrationItem[] = KEYS.map(({ key, label }) => {
    const v = process.env[key];
    return { key, label, masked: maskValue(v), configured: !!v };
  });

  // Carregar config WhatsApp + Email do tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: {
      notifConfig: true,
      emailFromName: true,
      emailFromAddress: true,
      googleCalendarEnabled: true,
    },
  });
  const wp = ((tenant?.notifConfig as any) || {}).whatsapp || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Integrações</h1>
        <p className="text-sm text-gray-600">
          Credenciais de integrações externas + configuração de canais de notificação.
        </p>
      </div>

      <WhatsAppPanel
        initial={{
          enabled: wp.enabled !== false,
          accountSidMasked: wp.accountSid ? maskValue(String(wp.accountSid)) : "",
          authTokenMasked: wp.authToken ? "•".repeat(12) + "****" : "",
          fromNumber: wp.fromNumber || process.env.TWILIO_WHATSAPP_FROM || "",
          events: wp.events || {},
        }}
      />

      <EmailPanel
        fromName={tenant?.emailFromName || ""}
        fromAddress={tenant?.emailFromAddress || ""}
        apiKeyMasked={maskValue(process.env.RESEND_API_KEY)}
      />

      <GoogleCalendarPanel
        enabled={!!tenant?.googleCalendarEnabled}
        gcalQuery={{
          state: searchParams?.gcal || null,
          reason: searchParams?.reason || null,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#0B2447]">Outras API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <IntegrationsClient items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
