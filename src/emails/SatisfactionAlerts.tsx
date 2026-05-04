import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { BaseEmail, Button, InfoBox, colors } from "./BaseEmail";

export type SatisfactionAlertsProps = {
  tenantNome: string;
  tenantLogoUrl?: string | null;
  tenantAddress?: string | null;
  appUrl?: string;
  globalAverage: number;
  responseRate: number;
  responseRateAlert: boolean;
  trainerAlerts: { name: string; average: number; count: number }[];
  staleActions: { code: string; name: string; daysSince: number | null }[];
  courseAlerts: { name: string; average: number; responses: number }[];
};

export function SatisfactionAlerts(props: SatisfactionAlertsProps) {
  const dashboardUrl = `${(props.appUrl || "http://localhost:3000").replace(/\/$/, "")}/admin/analytics/satisfaction`;
  const total =
    (props.responseRateAlert ? 1 : 0) +
    props.trainerAlerts.length +
    props.staleActions.length +
    props.courseAlerts.length;

  return (
    <BaseEmail
      preview={`${total} alerta(s) de satisfação na sua academia`}
      tenantNome={props.tenantNome}
      tenantLogoUrl={props.tenantLogoUrl}
      tenantAddress={props.tenantAddress}
    >
      <Heading as="h2" style={{ color: colors.navy, fontSize: 22, margin: "0 0 12px" }}>
        Resumo semanal de satisfação
      </Heading>
      <Text style={{ fontSize: 14, lineHeight: 1.6, color: colors.text, margin: "0 0 16px" }}>
        Identificámos <strong>{total} alerta(s)</strong> que requerem a sua atenção esta semana.
      </Text>

      <InfoBox>
        <Text style={{ margin: "4px 0", fontSize: 14 }}>
          <strong>Satisfação média:</strong> {props.globalAverage.toFixed(2)} / 5
        </Text>
        <Text style={{ margin: "4px 0", fontSize: 14 }}>
          <strong>Taxa de resposta:</strong> {props.responseRate}%
        </Text>
      </InfoBox>

      {props.responseRateAlert && (
        <div style={{ margin: "12px 0", padding: "12px 16px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6 }}>
          <Text style={{ margin: 0, fontSize: 13, color: "#78350F" }}>
            ⚠️ <strong>Taxa de resposta abaixo de 50%</strong> ({props.responseRate}%). Considere reforçar lembretes.
          </Text>
        </div>
      )}

      {props.trainerAlerts.length > 0 && (
        <div style={{ margin: "12px 0", padding: "12px 16px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6 }}>
          <Text style={{ margin: "0 0 8px", fontSize: 13, color: "#991B1B", fontWeight: 600 }}>
            🚨 {props.trainerAlerts.length} formador(es) com média &lt; 3.5
          </Text>
          {props.trainerAlerts.map((t, i) => (
            <Text key={i} style={{ margin: "2px 0", fontSize: 13, color: "#7F1D1D" }}>
              • {t.name} — <strong>{t.average.toFixed(2)}</strong> ({t.count} resp.)
            </Text>
          ))}
        </div>
      )}

      {props.staleActions.length > 0 && (
        <div style={{ margin: "12px 0", padding: "12px 16px", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6 }}>
          <Text style={{ margin: "0 0 8px", fontSize: 13, color: "#1E3A8A", fontWeight: 600 }}>
            ⏰ {props.staleActions.length} ação(ões) concluída(s) sem respostas há &gt; 7d
          </Text>
          {props.staleActions.slice(0, 8).map((a, i) => (
            <Text key={i} style={{ margin: "2px 0", fontSize: 13, color: "#1E40AF" }}>
              • {a.code} — {a.name} {a.daysSince !== null ? `(${a.daysSince}d)` : ""}
            </Text>
          ))}
        </div>
      )}

      {props.courseAlerts.length > 0 && (
        <div style={{ margin: "12px 0", padding: "12px 16px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6 }}>
          <Text style={{ margin: "0 0 8px", fontSize: 13, color: "#991B1B", fontWeight: 600 }}>
            📉 {props.courseAlerts.length} curso(s) abaixo de 3.5
          </Text>
          {props.courseAlerts.slice(0, 8).map((c, i) => (
            <Text key={i} style={{ margin: "2px 0", fontSize: 13, color: "#7F1D1D" }}>
              • {c.name} — <strong>{c.average.toFixed(2)}</strong> ({c.responses} resp.)
            </Text>
          ))}
        </div>
      )}

      <Text style={{ marginTop: 18 }}>
        <Button href={dashboardUrl}>Abrir dashboard</Button>
      </Text>
    </BaseEmail>
  );
}

export default SatisfactionAlerts;
