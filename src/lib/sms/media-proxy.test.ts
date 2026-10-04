import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffSmsMediaProxyPath } from "@/lib/sms/inbox-copy";
import { isAllowedTwilioMediaUrl } from "@/lib/sms/media-proxy";

describe("staff Twilio media proxy", () => {
  const accountSid = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("allows media URLs for this Twilio account", () => {
    assert.equal(
      isAllowedTwilioMediaUrl(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/MMxxx/Media/MExxx`,
        accountSid,
      ),
      true,
    );
  });

  it("rejects media URLs for other accounts or hosts", () => {
    assert.equal(
      isAllowedTwilioMediaUrl(
        "https://api.twilio.com/2010-04-01/Accounts/ACbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/Messages/MMxxx/Media/MExxx",
        accountSid,
      ),
      false,
    );
    assert.equal(
      isAllowedTwilioMediaUrl("https://example.com/photo.jpg", accountSid),
      false,
    );
  });

  it("builds an authenticated staff proxy path", () => {
    const url =
      "https://api.twilio.com/2010-04-01/Accounts/ACxx/Messages/MMxx/Media/MExx";
    assert.equal(
      staffSmsMediaProxyPath(url),
      `/api/admin/messages/media?url=${encodeURIComponent(url)}`,
    );
  });
});
