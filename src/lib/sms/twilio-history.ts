import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { isSmsConfigured } from "@/lib/sms/twilio";

function envValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

function twilioAuthHeader() {
  const accountSid = envValue("TWILIO_ACCOUNT_SID");
  const authToken = envValue("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) return null;
  return {
    accountSid,
    authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
  };
}

export type TwilioInboundMms = {
  sid: string;
  from: string;
  to: string;
  body: string;
  dateSent: string;
  mediaUrls: string[];
};

type TwilioMessageRow = {
  sid?: string;
  from?: string;
  to?: string;
  body?: string;
  date_sent?: string;
  direction?: string;
  num_media?: string;
};

type TwilioMediaRow = {
  sid?: string;
  uri?: string;
};

function mediaUrlFromTwilioUri(uri: string, accountSid: string) {
  const path = uri.replace(/\.json$/i, "");
  if (path.startsWith("http")) return path;
  if (path.includes(`/Accounts/${accountSid}/`) && path.includes("/Media/")) {
    return `https://api.twilio.com${path.startsWith("/") ? "" : "/"}${path}`;
  }
  return null;
}

export function buildTwilioMediaUrl(input: {
  accountSid: string;
  messageSid: string;
  mediaSid: string;
}) {
  return `https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Messages/${input.messageSid}/Media/${input.mediaSid}`;
}

async function fetchTwilioJson<T>(url: string, authorization: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: { Authorization: authorization, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Twilio history fetch failed:", response.status, url);
    return null;
  }
  return (await response.json()) as T;
}

export async function listTwilioMessageMediaUrls(input: {
  accountSid: string;
  authorization: string;
  messageSid: string;
}): Promise<string[]> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Messages/${input.messageSid}/Media.json?PageSize=20`;
  const data = await fetchTwilioJson<{ media_list?: TwilioMediaRow[] }>(
    url,
    input.authorization,
  );
  if (!data?.media_list?.length) return [];

  const urls: string[] = [];
  for (const media of data.media_list) {
    if (media.uri) {
      const fromUri = mediaUrlFromTwilioUri(media.uri, input.accountSid);
      if (fromUri) {
        urls.push(fromUri);
        continue;
      }
    }
    if (media.sid) {
      urls.push(
        buildTwilioMediaUrl({
          accountSid: input.accountSid,
          messageSid: input.messageSid,
          mediaSid: media.sid,
        }),
      );
    }
  }
  return urls.slice(0, 10);
}

/** Newest-first inbound MMS from Twilio (customer → studio). */
export async function listTwilioInboundMms(options?: {
  pageLimit?: number;
  pageSize?: number;
}): Promise<TwilioInboundMms[] | { error: "misconfigured" | "server" }> {
  if (!isSmsConfigured()) return { error: "misconfigured" };
  const auth = twilioAuthHeader();
  if (!auth) return { error: "misconfigured" };

  const pageLimit = Math.max(1, Math.min(options?.pageLimit ?? 5, 10));
  const pageSize = Math.max(1, Math.min(options?.pageSize ?? 50, 100));
  const results: TwilioInboundMms[] = [];
  let nextUrl: string | null =
    `https://api.twilio.com/2010-04-01/Accounts/${auth.accountSid}/Messages.json?PageSize=${pageSize}`;

  for (let page = 0; page < pageLimit && nextUrl; page += 1) {
    const data = await fetchTwilioJson<{
      messages?: TwilioMessageRow[];
      next_page_uri?: string | null;
    }>(nextUrl, auth.authorization);
    if (!data) return { error: "server" };

    for (const message of data.messages ?? []) {
      const numMedia = Number(message.num_media ?? 0);
      if (message.direction !== "inbound" || numMedia <= 0 || !message.sid) {
        continue;
      }
      const from = normalizePhoneToE164(message.from ?? "") ?? message.from ?? "";
      const to = normalizePhoneToE164(message.to ?? "") ?? message.to ?? "";
      if (!from) continue;

      const mediaUrls = await listTwilioMessageMediaUrls({
        accountSid: auth.accountSid,
        authorization: auth.authorization,
        messageSid: message.sid,
      });
      if (mediaUrls.length === 0) continue;

      results.push({
        sid: message.sid,
        from,
        to,
        body: (message.body ?? "").trim(),
        dateSent: message.date_sent ?? new Date().toISOString(),
        mediaUrls,
      });
    }

    nextUrl = data.next_page_uri
      ? `https://api.twilio.com${data.next_page_uri}`
      : null;
  }

  return results;
}
