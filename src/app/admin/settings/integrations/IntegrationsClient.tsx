"use client";

import { SecretField } from "@/components/admin/SecretField";

export type IntegrationItem = {
  key: string;
  label: string;
  masked: string;          // já mascarado (••••27bc)
  configured: boolean;
};

export function IntegrationsClient({ items }: { items: IntegrationItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((it) => (
        <div key={it.key} className="rounded border border-gray-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0B2447]">{it.label}</h3>
            <span
              className={`text-xs ${it.configured ? "text-green-700" : "text-gray-400"}`}
            >
              {it.configured ? "Configurado" : "Não configurado"}
            </span>
          </div>
          <SecretField
            label={it.key}
            value={it.masked}
            onReveal={async () => {
              const res = await fetch(`/api/admin/integrations/reveal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  key: it.key,
                  password: localStorage.getItem("__last_pw__") || "",
                }),
              });
              const j = await res.json().catch(() => ({}));
              return (j as any).value || it.masked;
            }}
          />
        </div>
      ))}
      <p className="text-xs text-gray-500">
        Os valores são lidos do servidor. O valor real só é visível durante 30 segundos
        após confirmação de identidade.
      </p>
    </div>
  );
}
