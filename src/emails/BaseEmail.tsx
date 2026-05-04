import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export type BaseEmailProps = {
  preview: string;
  tenantNome: string;
  tenantLogoUrl?: string | null;
  tenantAddress?: string | null;
  children: React.ReactNode;
};

export const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  navy: "#0B2447",
  navyDark: "#06173A",
  gold: "#C9A520",
  blue: "#1566C0",
  text: "#1a1a1a",
  muted: "#666666",
  border: "#E5E7EB",
};

export const Button: React.FC<{
  href: string;
  children: React.ReactNode;
  bg?: string;
}> = ({ href, children, bg = colors.blue }) => (
  <a
    href={href}
    style={{
      backgroundColor: bg,
      color: "#ffffff",
      display: "inline-block",
      padding: "12px 24px",
      borderRadius: "6px",
      textDecoration: "none",
      fontWeight: 600,
      fontSize: "14px",
    }}
  >
    {children}
  </a>
);

export const InfoBox: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Section
    style={{
      backgroundColor: colors.background,
      border: `1px solid ${colors.border}`,
      borderRadius: "6px",
      padding: "16px 20px",
      margin: "16px 0",
    }}
  >
    {children}
  </Section>
);

export const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <Text
    style={{
      margin: "4px 0",
      fontSize: "14px",
      color: colors.text,
      lineHeight: "1.5",
    }}
  >
    <span style={{ color: colors.muted, fontWeight: 600 }}>{label}: </span>
    <span>{value}</span>
  </Text>
);

export const BaseEmail: React.FC<BaseEmailProps> = ({
  preview,
  tenantNome,
  tenantLogoUrl,
  tenantAddress,
  children,
}) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Body
      style={{
        backgroundColor: colors.background,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        margin: 0,
        padding: 0,
        color: colors.text,
      }}
    >
      <Container
        style={{
          backgroundColor: colors.surface,
          margin: "32px auto",
          padding: 0,
          maxWidth: "600px",
          borderRadius: "8px",
          overflow: "hidden",
          border: `1px solid ${colors.border}`,
        }}
      >
        {/* Header */}
        <Section
          style={{
            backgroundColor: colors.navy,
            padding: "24px 32px",
            textAlign: "center",
          }}
        >
          {tenantLogoUrl ? (
            <Img
              src={tenantLogoUrl}
              alt={tenantNome}
              height="40"
              style={{ display: "inline-block", maxHeight: "40px" }}
            />
          ) : (
            <Text
              style={{
                color: "#ffffff",
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "1px",
                margin: 0,
              }}
            >
              {tenantNome}
            </Text>
          )}
        </Section>

        {/* Body */}
        <Section style={{ padding: "32px" }}>{children}</Section>

        {/* Footer */}
        <Hr style={{ margin: 0, borderColor: colors.border }} />
        <Section
          style={{
            backgroundColor: colors.background,
            padding: "20px 32px",
            color: colors.muted,
            fontSize: "12px",
            lineHeight: "1.5",
            textAlign: "center",
          }}
        >
          <Text style={{ margin: "0 0 4px", fontWeight: 600 }}>
            {tenantNome}
          </Text>
          {tenantAddress && (
            <Text style={{ margin: "0 0 4px" }}>{tenantAddress}</Text>
          )}
          <Text style={{ margin: "8px 0 0", fontStyle: "italic" }}>
            Não responda a este email — esta mensagem foi enviada automaticamente.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);
