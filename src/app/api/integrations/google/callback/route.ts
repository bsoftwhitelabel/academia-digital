import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/google-calendar";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const settingsUrl = "/admin/settings/integrations";

  if (error) {
    return NextResponse.redirect(new URL(`${settingsUrl}?gcal=error&reason=${encodeURIComponent(error)}`, req.url));
  }
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL(`${settingsUrl}?gcal=error&reason=missing_params`, req.url));
  }

  // Verify state
  const cookieState = req.headers.get("cookie")?.match(/gcal_oauth_state=([^;]+)/)?.[1];
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL(`${settingsUrl}?gcal=error&reason=state_mismatch`, req.url));
  }
  const [tenantIdFromState] = state.split(".");
  if (tenantIdFromState !== session.user.tenantId && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL(`${settingsUrl}?gcal=error&reason=tenant_mismatch`, req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await prisma.tenant.update({
      where: { id: tenantIdFromState },
      data: {
        googleCalendarTokens: tokens as any,
        googleCalendarEnabled: true,
      },
    });
    await logAudit({
      action: "UPDATE",
      resource: "Tenant",
      resourceId: tenantIdFromState,
      userId: session.user.id,
      tenantId: tenantIdFromState,
      changes: { after: { googleCalendarEnabled: true } },
      req,
    });
    const res = NextResponse.redirect(new URL(`${settingsUrl}?gcal=connected`, req.url));
    res.cookies.delete("gcal_oauth_state");
    return res;
  } catch (e: any) {
    console.error("Google OAuth callback error:", e);
    return NextResponse.redirect(new URL(`${settingsUrl}?gcal=error&reason=token_exchange`, req.url));
  }
}
