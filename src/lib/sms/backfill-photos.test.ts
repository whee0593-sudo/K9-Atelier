import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { pickMatchingInboxRow } from "@/lib/sms/backfill-photos";
import { buildTwilioMediaUrl } from "@/lib/sms/twilio-history";

describe("staff SMS photo backfill", () => {
  it("builds a Twilio media URL for the account message", () => {
    assert.equal(
      buildTwilioMediaUrl({
        accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        messageSid: "MMbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        mediaSid: "MEcccccccccccccccccccccccccccccccc",
      }),
      "https://api.twilio.com/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/MMbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/Media/MEcccccccccccccccccccccccccccccccc",
    );
  });

  it("updates a nearby Photo inbox row that still has no media", () => {
    const match = pickMatchingInboxRow({
      rows: [
        {
          id: "row-1",
          phone: "+15615550188",
          body: "Photo",
          media_urls: [],
          created_at: "2026-08-22T14:20:05.000Z",
        },
      ],
      from: "+15615550188",
      dateSent: "Thu, 22 Aug 2026 14:20:00 +0000",
      mediaUrls: [
        "https://api.twilio.com/2010-04-01/Accounts/ACxx/Messages/MMxx/Media/MExx",
      ],
    });
    assert.deepEqual(match, { id: "row-1", alreadyHasMedia: false });
  });

  it("skips rows that already contain the media URL", () => {
    const url =
      "https://api.twilio.com/2010-04-01/Accounts/ACxx/Messages/MMxx/Media/MExx";
    const match = pickMatchingInboxRow({
      rows: [
        {
          id: "row-1",
          phone: "+15615550188",
          body: "Photo",
          media_urls: [url],
          created_at: "2026-08-22T14:20:05.000Z",
        },
      ],
      from: "+15615550188",
      dateSent: "Thu, 22 Aug 2026 14:20:00 +0000",
      mediaUrls: [url],
    });
    assert.deepEqual(match, { id: "row-1", alreadyHasMedia: true });
  });

  it("exposes a staff backfill API route", () => {
    const route = readFileSync(
      new URL("../../app/api/admin/messages/backfill-photos/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(route, /backfillStaffSmsPhotos/);
    const composer = readFileSync(
      new URL("../../components/admin/AdminMessageComposer.tsx", import.meta.url),
      "utf8",
    );
    assert.match(composer, /Import past photos/);
  });
});
