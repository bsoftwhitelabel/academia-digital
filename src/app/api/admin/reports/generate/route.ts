import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildReport, ReportType, ReportFilters } from "@/lib/reports";
import { generatePDF } from "@/lib/pdf";
import * as XLSX from "xlsx";

const VALID_TYPES: ReportType[] = ["ENROLLMENTS", "ATTENDANCE", "SATISFACTION", "BUDGET", "TRAINERS_HOURS", "CERTIFICATES"];

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const type = body.type as ReportType;
  const format = (body.format || "json") as "json" | "xlsx" | "pdf";
  const filters: ReportFilters = body.filters || {};

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid report type: ${type}` }, { status: 400 });
  }

  const report = await buildReport(type, session.user.tenantId, filters);

  if (format === "json") {
    return NextResponse.json(report);
  }

  const filenameSafe = report.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "_");
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const headers = report.columns.map((c) => c.label);
    const data = [
      headers,
      ...report.rows.map((r) => report.columns.map((c) => r[c.key] ?? "")),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, report.title.slice(0, 31));
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameSafe}_${stamp}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const html = `<!DOCTYPE html>
<html lang="pt-PT"><head><meta charset="UTF-8" /><title>${escapeHtml(report.title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
  h1 { color: #0B2447; font-size: 22px; margin: 0 0 4px; }
  .sub { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #0B2447; color: white; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280; text-align: center; }
</style></head><body>
  <h1>${escapeHtml(report.title)}</h1>
  <div class="sub">${report.rows.length} registo(s) · Gerado em ${new Date().toLocaleString("pt-PT")}${
    filters.from || filters.to ? ` · Período: ${filters.from || "?"} → ${filters.to || "?"}` : ""
  }</div>
  <table>
    <thead><tr>${report.columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead>
    <tbody>
      ${report.rows.map((r) => `<tr>${report.columns.map((c) => `<td>${escapeHtml(String(r[c.key] ?? ""))}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
  <footer>Academia Digital · Relatório ${escapeHtml(report.title)} · ${stamp}</footer>
</body></html>`;
    const pdf = await generatePDF(html, { format: "A4", landscape: report.columns.length > 6 });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameSafe}_${stamp}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}
