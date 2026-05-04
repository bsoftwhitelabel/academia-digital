import * as React from "react";
import { Heading, Img, Text } from "@react-email/components";
import { BaseEmail, Button, InfoBox, InfoRow, colors } from "./BaseEmail";

export type CertificateIssuedProps = {
  formandoNome: string;
  cursoNome: string;
  dataConclusao: string;        // dd/mm/yyyy
  certificateId: string;
  pdfUrl: string;               // URL pública (R2) ou /api/pdf/certificate/[id]
  verificationCode: string;
  qrDataUrl?: string | null;    // PNG inline base64
  tenantNome: string;
  tenantLogoUrl?: string | null;
  tenantAddress?: string | null;
};

export function CertificateIssued(props: CertificateIssuedProps) {
  return (
    <BaseEmail
      preview={`O seu certificado está pronto — ${props.cursoNome}`}
      tenantNome={props.tenantNome}
      tenantLogoUrl={props.tenantLogoUrl}
      tenantAddress={props.tenantAddress}
    >
      <Heading as="h2" style={{ color: colors.navy, fontSize: 22, margin: "0 0 12px" }}>
        O seu certificado está pronto
      </Heading>
      <Text style={{ fontSize: 14, lineHeight: 1.6, color: colors.text, margin: "0 0 12px" }}>
        Parabéns, <strong>{props.formandoNome}</strong>! Pela conclusão de{" "}
        <strong>{props.cursoNome}</strong>, emitimos o seu certificado.
      </Text>

      <InfoBox>
        <InfoRow label="Curso" value={props.cursoNome} />
        <InfoRow label="Data de conclusão" value={props.dataConclusao} />
        <InfoRow label="Código de verificação" value={props.verificationCode} />
      </InfoBox>

      <Text style={{ marginTop: 16 }}>
        <Button href={props.pdfUrl}>Descarregar Certificado</Button>
      </Text>

      {props.qrDataUrl && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Img
            src={props.qrDataUrl}
            alt="QR de verificação"
            width="120"
            height="120"
            style={{
              display: "inline-block",
              border: `1px solid ${colors.border}`,
              padding: 6,
              borderRadius: 6,
              backgroundColor: "#fff",
            }}
          />
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
            Verificar autenticidade
          </Text>
        </div>
      )}

      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 24 }}>
        Pode confirmar a autenticidade do certificado em qualquer altura usando
        o código acima ou o QR code.
      </Text>
    </BaseEmail>
  );
}

export default CertificateIssued;
