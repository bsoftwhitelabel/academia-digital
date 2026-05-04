import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-calendar";
import { randomBytes } from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // state = tenantId.nonce — verificado no callback
  const nonce = randomBytes(16).toString("hex");
  const state = `${session.user.tenantId}.${nonce}`;

  try {
    const url = getAuthUrl(state);
    const res = NextResponse.redirect(url);
    res.cookies.set("gcal_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
