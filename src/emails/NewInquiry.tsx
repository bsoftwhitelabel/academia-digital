import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { BaseEmail, Button, InfoBox, InfoRow, colors } from "./BaseEmail";

export type NewInquiryProps = {
  inquiryNome: string;
  inquiryEmail: string;
  inquiryEmpresa?: string | null;
  inquiryCargo?: string | null;
  inquiryTelefone?: string | null;
  cursoNome: string;
  mensagem?: string | null;
  tenantNome: string;
  tenantLogoUrl?: string | null;
  tenantAddress?: string | null;
  appUrl?: string;
};

export function NewInquiry(props: NewInquiryProps) {
  const adminUrl = `${(props.appUrl || "http://localhost:3000").replace(/\/$/, "")}/admin/inquiries`;
  return (
    <BaseEmail
      preview={`Novo lead: ${props.inquiryNome} — ${props.cursoNome}`}
      tenantNome={props.tenantNome}
      tenantLogoUrl={props.tenantLogoUrl}
      tenantAddress={props.tenantAddress}
    >
      <Heading as="h2" style={{ color: colors.navy, fontSize: 22, margin: "0 0 12px" }}>
        Novo interesse no catálogo
      </Heading>
      <Text style={{ fontSize: 14, lineHeight: 1.6, color: colors.text, margin: "0 0 12px" }}>
        Foi recebido um novo formulário de interesse via catálogo público.
      </Text>

      <InfoBox>
        <InfoRow label="Nome" value={props.inquiryNome} />
        <InfoRow label="Email" value={props.inquiryEmail} />
        <InfoRow label="Telefone" value={props.inquiryTelefone || "—"} />
        <InfoRow label="Empresa" value={props.inquiryEmpresa || "—"} />
        <InfoRow label="Cargo" value={props.inquiryCargo || "—"} />
        <InfoRow label="Curso" value={props.cursoNome} />
      </InfoBox>

      {props.mensagem && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 16px",
            backgroundColor: "#FFFBEB",
            border: `1px solid #FDE68A`,
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.5,
            color: "#78350F",
          }}
        >
          <strong>Mensagem:</strong> {props.mensagem}
        </div>
      )}

      <Text style={{ marginTop: 18 }}>
        <Button href={adminUrl}>Ver no painel</Button>
      </Text>
    </BaseEmail>
  );
}

export default NewInquiry;
