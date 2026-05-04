import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateSIGOActionsXML, generateSIGOTraineesXML } from "@/lib/sigo";
import { logAudit } from "@/lib/audit";

function ymdNow(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantId = session.user.tenantId;

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "ACTIONS").toUpperCase();
  const actionIdsParam = url.searchParams.get("actionIds") || "";
  const actionIds = actionIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const actionId = url.searchParams.get("actionId") || actionIds[0];

  let xml: string;
  let filename: string;

  try {
    if (type === "ACTIONS") {
      if (actionIds.length === 0) {
        return NextResponse.json({ error: "actionIds obrigatório" }, { status: 400 });
      }
      xml = await generateSIGOActionsXML(tenantId, actionIds);
      filename = `SIGO-ACTIONS-${ymdNow()}.xml`;
    } else if (type === "TRAINEES") {
      if (!actionId) {
        return NextResponse.json({ error: "actionId obrigatório" }, { status: 400 });
      }
      xml = await generateSIGOTraineesXML(tenantId, actionId);
      filename = `SIGO-TRAINEES-${ymdNow()}.xml`;
    } else {
      return NextResponse.json({ error: `type "${type}" inválido` }, { status: 400 });
    }

    await logAudit({
      action: "VIEW",
      resource: "SIGO",
      resourceId: type === "ACTIONS" ? actionIds.join(",") : actionId!,
      userId: session.user.id,
      tenantId,
      changes: { after: { type, count: type === "ACTIONS" ? actionIds.length : 1 } },
      req,
    });

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("SIGO export error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
