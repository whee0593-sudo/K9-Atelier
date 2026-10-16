import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, beforeEach, describe, it, mock } from "node:test";
import { POST } from "@/app/api/support/route";
import { business } from "@/lib/business";
import {
  EMAIL_INQUIRY_NOTICE,
  PHONE_AVAILABLE_NOTICE,
} from "@/lib/support-mail";
import {
  SUPPORT_CONTACT_INVALID,
  SUPPORT_CONTACT_REQUIRED,
  SUPPORT_EMAIL_INVALID,
  SUPPORT_PHONE_INVALID,
} from "@/lib/support-contact";
import { clearRateLimitStore } from "@/lib/rate-limit";

const originalResendKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.SUPPORT_FROM_EMAIL;
const fromEmail = "K9 Atelier <notices@k9atelier.com>";

type SentMail = {
  url: string;
  body: {
    from?: string;
    to?: string[];
    subject?: string;
    text?: string;
    reply_to?: string;
  };
};

let sent: SentMail[] = [];
let ip = 20;

function nextIp() {
  ip += 1;
  return `203.0.113.${ip}`;
}

function installFetchMock() {
  sent = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url !== "https://api.resend.com/emails") {
      throw new Error(`Unexpected outbound request: ${url}`);
    }
    sent.push({
      url,
      body: JSON.parse(String(init?.body ?? "{}")) as SentMail["body"],
    });
    return new Response(JSON.stringify({ id: "email_test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function postJson(body: unknown, extraHeaders?: Record<string, string>) {
  return new Request("http://localhost/api/support", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": nextIp(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mock.restoreAll();
  clearRateLimitStore();
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.SUPPORT_FROM_EMAIL = fromEmail;
  installFetchMock();
});

after(() => {
  mock.restoreAll();
  if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalResendKey;
  if (originalFrom === undefined) delete process.env.SUPPORT_FROM_EMAIL;
  else process.env.SUPPORT_FROM_EMAIL = originalFrom;
});

describe("contact notification routing", () => {
  it("does not send SMS from the contact route", () => {
    const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
    assert.equal(source.includes("sendSms"), false);
    assert.equal(source.includes("twilio"), false);
    assert.equal(source.includes("api.resend.com/emails"), true);
  });

  it("sets Reply-To and the email notice for email only", async () => {
    const response = await POST(
      postJson({
        email: "guest@example.com",
        phone: "",
        inquiryType: "general",
        subject: "Milkshake",
        message: "Please book Milkshake.",
      }),
    );
    const body = (await response.json()) as { ok?: boolean };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(sent.length, 1);
    const mail = sent[0]!.body;
    assert.equal(mail.from, fromEmail);
    assert.deepEqual(mail.to, [business.brand.email]);
    assert.equal(mail.reply_to, "guest@example.com");
    assert.equal(mail.subject, "K9 Atelier: Milkshake (Email: guest@example.com)");
    assert.ok(mail.text?.startsWith(EMAIL_INQUIRY_NOTICE));
    assert.equal(mail.text?.includes(PHONE_AVAILABLE_NOTICE), false);
  });

  it("omits Reply-To and asks for SMS when only a phone is left", async () => {
    const response = await POST(
      postJson({
        email: "",
        phone: "8476245115",
        inquiryType: "general",
        subject: "Milkshake",
        message: "Please book Milkshake.",
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(sent.length, 1);
    const mail = sent[0]!.body;
    assert.equal("reply_to" in mail, false);
    assert.equal(mail.reply_to, undefined);
    assert.equal(mail.to?.[0], business.brand.email);
    assert.equal(mail.from, fromEmail);
    assert.ok(mail.text?.startsWith(PHONE_AVAILABLE_NOTICE));
    assert.match(mail.text ?? "", /Phone: 8476245115/);
    assert.equal(mail.text?.includes("\nEmail:"), false);
    assert.match(mail.text ?? "", /Email Reply will NOT send an SMS/);
  });

  it("prefers the SMS notice when both channels are present and keeps Reply-To", async () => {
    const form = new FormData();
    form.set("email", "guest@example.com");
    form.set("phone", "(847) 624-5115");
    form.set("inquiryType", "general");
    form.set("subject", "Milkshake");
    form.set("message", "Todd & Brook 希望预约 Milkshake。");
    const response = await POST(
      new Request("http://localhost/api/support", {
        method: "POST",
        headers: { "x-forwarded-for": nextIp() },
        body: form,
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(sent.length, 1);
    const mail = sent[0]!.body;
    assert.equal(mail.reply_to, "guest@example.com");
    assert.equal(mail.reply_to === "(847) 624-5115", false);
    assert.ok(mail.text?.startsWith(PHONE_AVAILABLE_NOTICE));
    assert.equal(mail.text?.includes(EMAIL_INQUIRY_NOTICE), false);
    assert.match(mail.text ?? "", /Phone: \(847\) 624-5115/);
    assert.match(mail.text ?? "", /Email: guest@example.com/);
    assert.match(mail.text ?? "", /Todd & Brook/);
  });

  it("rejects an empty or illegal contact method without sending", async () => {
    const cases: Array<{ body: unknown; error: string }> = [
      {
        body: { email: "", phone: "", subject: "Hi", message: "Hello" },
        error: SUPPORT_CONTACT_REQUIRED,
      },
      {
        body: { subject: "Hi", message: "Hello" },
        error: SUPPORT_CONTACT_REQUIRED,
      },
      {
        body: { email: "not-an-email", subject: "Hi", message: "Hello" },
        error: SUPPORT_EMAIL_INVALID,
      },
      {
        body: { phone: "123", subject: "Hi", message: "Hello" },
        error: SUPPORT_PHONE_INVALID,
      },
      {
        body: {
          email: "guest@example.com",
          phone: "12",
          subject: "Hi",
          message: "Hello",
        },
        error: SUPPORT_PHONE_INVALID,
      },
    ];

    for (const item of cases) {
      const response = await POST(postJson(item.body));
      const body = (await response.json()) as { error?: string; ok?: boolean };
      assert.equal(response.status, 400, JSON.stringify(item.body));
      assert.equal(body.error, item.error);
      assert.equal(body.ok, undefined);
    }
    assert.equal(sent.length, 0);
  });

  it("still accepts the legacy contact field for email and phone", async () => {
    const emailResponse = await POST(
      postJson({
        contact: "legacy@example.com",
        subject: "Hello",
        message: "Old client",
        inquiryType: "general",
      }),
    );
    assert.equal(emailResponse.status, 200);
    assert.equal(sent[0]?.body.reply_to, "legacy@example.com");
    assert.ok(sent[0]?.body.text?.startsWith(EMAIL_INQUIRY_NOTICE));

    const form = new FormData();
    form.set("contact", "8476245115");
    form.set("subject", "Hello");
    form.set("message", "Old form");
    form.set("inquiryType", "general");
    const phoneResponse = await POST(
      new Request("http://localhost/api/support", {
        method: "POST",
        headers: { "x-forwarded-for": nextIp() },
        body: form,
      }),
    );
    assert.equal(phoneResponse.status, 200);
    assert.equal("reply_to" in (sent[1]?.body ?? {}), false);
    assert.ok(sent[1]?.body.text?.startsWith(PHONE_AVAILABLE_NOTICE));

    const concern = await POST(
      postJson({
        contact: "8476245115",
        topic: "concern",
        message: "Something happened",
      }),
    );
    assert.equal(concern.status, 200);
    assert.equal(sent.length, 3);
    assert.match(sent[2]?.body.subject ?? "", /^K9 Atelier concern \(Phone: 8476245115\)$/);
    assert.ok(sent[2]?.body.text?.includes("New private concern"));

    const invalid = await POST(
      postJson({ contact: "hello", subject: "Hi", message: "Old client" }),
    );
    const invalidBody = (await invalid.json()) as { error?: string };
    assert.equal(invalid.status, 400);
    assert.equal(invalidBody.error, SUPPORT_CONTACT_INVALID);
    assert.equal(sent.length, 3);
  });

  it("does not call Resend when support email is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    const response = await POST(
      postJson({
        email: "guest@example.com",
        subject: "Hi",
        message: "Hello",
      }),
    );
    const body = (await response.json()) as { error?: string };
    assert.equal(response.status, 503);
    assert.match(body.error ?? "", /not configured/i);
    assert.equal(sent.length, 0);
    process.env.RESEND_API_KEY = "re_test_key";
  });
});
