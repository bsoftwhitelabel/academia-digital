import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { BaseEmail, Button, InfoBox, InfoRow, colors } from "./BaseEmail";

export type QuestionnaireAvailableProps = {
  formandoNome: string;
  cursoNome: string;
  linkSurvey: string;
  tenantNome: string;
  tenantLogoUrl?: string | null;
  tenantAddress?: string | null;
};

export function QuestionnaireAvailable(props: QuestionnaireAvailableProps) {
  return (
    <BaseEmail
      preview={`Avalie a formação ${props.cursoNome}`}
      tenantNome={props.tenantNome}
      tenantLogoUrl={props.tenantLogoUrl}
      tenantAddress={props.tenantAddress}
    >
      <Heading as="h2" style={{ color: colors.navy, fontSize: 22, margin: "0 0 12px" }}>
        A sua opinião conta
      </Heading>
      <Text style={{ fontSize: 14, lineHeight: 1.6, color: colors.text, margin: "0 0 12px" }}>
        Olá <strong>{props.formandoNome}</strong>, por favor avalie a formação{" "}
        <strong>{props.cursoNome}</strong>. Demora apenas 2 minutos.
      </Text>

      <InfoBox>
        <InfoRow label="Formação" value={props.cursoNome} />
      </InfoBox>

      <Text style={{ marginTop: 16 }}>
        <Button href={props.linkSurvey}>Avaliar agora</Button>
      </Text>

      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 16 }}>
        As suas respostas são confidenciais e ajudam a melhorar a qualidade da formação.
      </Text>
    </BaseEmail>
  );
}

export default QuestionnaireAvailable;
