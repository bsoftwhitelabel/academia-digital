import { google } from "googleapis";
import prisma from "@/lib/prisma";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export function getOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET não configurados.");
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const callback = redirectUri || `${baseUrl}/api/integrations/google/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, callback);
}

export function getAuthUrl(state: string): string {
  const oauth2 = getOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2 = getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

async function getCalendarClient(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.googleCalendarEnabled || !tenant?.googleCalendarTokens) {
    return null;
  }
  const tokens = tenant.googleCalendarTokens as any;
  const oauth2 = getOAuthClient();
  oauth2.setCredentials(tokens);

  // Auto-refresh
  oauth2.on("tokens", async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { googleCalendarTokens: merged },
    });
  });

  return google.calendar({ version: "v3", auth: oauth2 });
}

function sessionToEvent(args: {
  courseName: string;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  location: string | null;
  description?: string;
}) {
  const ymd = args.sessionDate.toISOString().slice(0, 10);
  const tz = "Europe/Lisbon";
  return {
    summary: `Formação: ${args.courseName}`,
    location: args.location || undefined,
    description: args.description || undefined,
    start: { dateTime: `${ymd}T${args.startTime}:00`, timeZone: tz },
    end: { dateTime: `${ymd}T${args.endTime}:00`, timeZone: tz },
  };
}

export async function createCalendarEvent(
  tenantId: string,
  args: {
    courseName: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    location: string | null;
    description?: string;
  }
): Promise<string | null> {
  try {
    const cal = await getCalendarClient(tenantId);
    if (!cal) return null;
    const res = await cal.events.insert({
      calendarId: "primary",
      requestBody: sessionToEvent(args),
    });
    return res.data.id || null;
  } catch (e) {
    console.error("[google-calendar] create event failed:", e);
    return null;
  }
}

export async function updateCalendarEvent(
  tenantId: string,
  eventId: string,
  args: {
    courseName: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    location: string | null;
    description?: string;
  }
): Promise<boolean> {
  try {
    const cal = await getCalendarClient(tenantId);
    if (!cal) return false;
    await cal.events.update({
      calendarId: "primary",
      eventId,
      requestBody: sessionToEvent(args),
    });
    return true;
  } catch (e) {
    console.error("[google-calendar] update event failed:", e);
    return false;
  }
}

export async function deleteCalendarEvent(tenantId: string, eventId: string): Promise<boolean> {
  try {
    const cal = await getCalendarClient(tenantId);
    if (!cal) return false;
    await cal.events.delete({ calendarId: "primary", eventId });
    return true;
  } catch (e) {
    console.error("[google-calendar] delete event failed:", e);
    return false;
  }
}
