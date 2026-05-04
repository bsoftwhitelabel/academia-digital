import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { BaseEmail, Button, InfoBox, InfoRow, colors } from "./BaseEmail";

export type SignatureEnabledProps = {
  formandoNome: string;
  cursoNome: string;
  sessaoData: string;          // dd/mm/yyyy
  documentId: string;
  expiresAt?: string | null;   // dd/mm/yyyy hh:mm (opcional)
  notes?: string | null;       // justificação do formador
  tenantNome: string;
  tenantLogoUrl?: string | null;
  tenantAddress?: string | null;
  appUrl?: string;
};

export function SignatureEnabled(props: SignatureEnabledProps) {
  const sign = `${(props.appUrl || "http://localhost:3000").replace(/\/$/, "")}/trainee/sign/${props.documentId}`;
  return (
    <BaseEmail
      preview={`Assinatura disponível — ${props.cursoNome}`}
      tenantNome={props.tenantNome}
      tenantLogoUrl={props.tenantLogoUrl}
      tenantAddress={props.tenantAddress}
    >
      <Heading as="h2" style={{ color: colors.navy, fontSize: 22, margin: "0 0 12px" }}>
        A sua assinatura está disponível
      </Heading>
      <Text style={{ fontSize: 14, lineHeight: 1.6, color: colors.text, margin: "0 0 12px" }}>
        Olá <strong>{props.formandoNome}</strong>, o formador habilitou a sua
        assinatura para a sessão de <strong>{props.cursoNome}</strong>.
      </Text>

      <InfoBox>
        <InfoRow label="Curso" value={props.cursoNome} />
        <InfoRow label="Sessão" value={props.sessaoData} />
        {props.expiresAt && <InfoRow label="Válido até" value={props.expiresAt} />}
        {props.notes && <InfoRow label="Nota do formador" value={props.notes} />}
      </InfoBox>

      <Text style={{ marginTop: 16 }}>
        <Button href={sign}>Assinar Agora</Button>
      </Text>

      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 16 }}>
        A sua assinatura é registada com data, IP e dispositivo para fins legais (DGERT).
      </Text>
    </BaseEmail>
  );
}

export default SignatureEnabled;
