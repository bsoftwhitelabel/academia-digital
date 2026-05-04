import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { BaseEmail, Button, InfoBox, InfoRow, colors } from "./BaseEmail";

export type SessionReminderProps = {
  formandoNome: string;
  cursoNome: string;
  data: string;          // dd/mm/yyyy
  horaInicio: string;    // "09:00"
  horaFim: string;       // "17:00"
  local: string;
  sessionId: string;
  tenantNome: string;
  tenantLogoUrl?: string | null;
  tenantAddress?: string | null;
  appUrl?: string;
};

export function SessionReminder(props: SessionReminderProps) {
  const checkin = `${(props.appUrl || "http://localhost:3000").replace(/\/$/, "")}/trainee/checkin/${props.sessionId}`;
  return (
    <BaseEmail
      preview={`A sua sessão é amanhã — ${props.cursoNome}`}
      tenantNome={props.tenantNome}
      tenantLogoUrl={props.tenantLogoUrl}
      tenantAddress={props.tenantAddress}
    >
      <Heading as="h2" style={{ color: colors.navy, fontSize: 22, margin: "0 0 12px" }}>
        A sua sessão é amanhã
      </Heading>
      <Text style={{ fontSize: 14, lineHeight: 1.6, color: colors.text, margin: "0 0 12px" }}>
        Olá <strong>{props.formandoNome}</strong>, lembramos que tem sessão amanhã.
      </Text>

      <InfoBox>
        <InfoRow label="Curso" value={props.cursoNome} />
        <InfoRow label="Data" value={props.data} />
        <InfoRow label="Hora" value={`${props.horaInicio} – ${props.horaFim}`} />
        <InfoRow label="Local / Modalidade" value={props.local} />
      </InfoBox>

      <Text style={{ marginTop: 16 }}>
        <Button href={checkin}>Fazer Check-in</Button>
      </Text>

      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 16 }}>
        O check-in abre 15 minutos antes do início da sessão.
      </Text>
    </BaseEmail>
  );
}

export default SessionReminder;
