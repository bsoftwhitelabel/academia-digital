import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { BaseEmail, Button, InfoBox, InfoRow, colors } from "./BaseEmail";

export type EnrollmentConfirmedProps = {
  formandoNome: string;
  cursoNome: string;
  dataInicio: string;        // já formatado (dd/mm/yyyy)
  dataFim: string;
  local: string;
  tenantNome: string;
  tenantLogoUrl?: string | null;
  tenantAddress?: string | null;
  appUrl?: string;
};

export function EnrollmentConfirmed(props: EnrollmentConfirmedProps) {
  const dashboard = `${(props.appUrl || "http://localhost:3000").replace(/\/$/, "")}/trainee/dashboard`;
  return (
    <BaseEmail
      preview={`Inscrição confirmada — ${props.cursoNome}`}
      tenantNome={props.tenantNome}
      tenantLogoUrl={props.tenantLogoUrl}
      tenantAddress={props.tenantAddress}
    >
      <Heading
        as="h2"
        style={{ color: colors.navy, fontSize: 22, margin: "0 0 12px" }}
      >
        Olá, {props.formandoNome}!
      </Heading>
      <Text style={{ fontSize: 14, lineHeight: 1.6, color: colors.text, margin: "0 0 12px" }}>
        A sua inscrição no curso <strong>{props.cursoNome}</strong> foi confirmada.
      </Text>

      <InfoBox>
        <InfoRow label="Data de início" value={props.dataInicio} />
        <InfoRow label="Data de fim" value={props.dataFim} />
        <InfoRow label="Local / Modalidade" value={props.local} />
      </InfoBox>

      <Text style={{ marginTop: 16 }}>
        <Button href={dashboard}>Ver os Meus Cursos</Button>
      </Text>

      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 24 }}>
        Receberá um lembrete por email 24h antes de cada sessão.
      </Text>
    </BaseEmail>
  );
}

export default EnrollmentConfirmed;
