import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import {
  CallerTextDialog,
  INITIAL_VISIBLE_RECENT_CALLERS,
  RECENT_CALLERS_PAGE_SIZE,
  RecentCallersList,
  nextVisibleRecentCallerCount,
} from "@/components/admin/AdminMessageComposer";
import {
  hasStaffSmsRecipientIdentity,
  type StudioUnknownCaller,
} from "@/lib/sms/staff-compose-copy";
import { buildPreviewStaffMessages } from "@/lib/sms/staff-compose-preview";

function callers(count: number): StudioUnknownCaller[] {
  return Array.from({ length: count }, (_, index) => ({
    phone: `+1561555${String(1000 + index)}`,
    calledAt: new Date(Date.UTC(2026, 7, 22, 13, 40 - index)).toISOString(),
    introSentAt: null,
  }));
}

describe("Recent callers list", () => {
  it("starts with two rows and reveals five more at a time", () => {
    assert.equal(INITIAL_VISIBLE_RECENT_CALLERS, 2);
    assert.equal(RECENT_CALLERS_PAGE_SIZE, 5);
    assert.equal(nextVisibleRecentCallerCount(2, 12), 7);
    assert.equal(nextVisibleRecentCallerCount(7, 12), 12);
    assert.equal(nextVisibleRecentCallerCount(7, 9), 9);
  });

  it("renders two caller rows and a More button when older calls are hidden", () => {
    const list = callers(9);
    const html = renderToStaticMarkup(
      <RecentCallersList
        callers={list}
        sending={false}
        onSendMessage={() => true}
      />,
    );

    assert.ok(html.includes(list[0].phone));
    assert.ok(html.includes(list[1].phone));
    assert.equal(html.includes(list[2].phone), false);
    assert.match(html, />More</);
    assert.equal(html.match(/Call back/g)?.length, 2);
  });

  it("hides More when every caller already fits in the first two rows", () => {
    const html = renderToStaticMarkup(
      <RecentCallersList
        callers={callers(2)}
        sending={false}
        onSendMessage={() => true}
      />,
    );

    assert.doesNotMatch(html, />More</);
    assert.equal(html.match(/Call back/g)?.length, 2);
  });

  it("opens a message box with a send button and a close control", () => {
    const html = renderToStaticMarkup(
      <CallerTextDialog
        open
        phone="+15615550444"
        message=""
        onMessageChange={() => undefined}
        onClose={() => undefined}
        onSend={() => undefined}
      />,
    );

    assert.match(html, /role="dialog"/);
    assert.match(html, /<textarea/);
    assert.match(html, /Write a message/);
    assert.match(html, />Send text</);
    assert.match(html, /disabled=""/);
    assert.match(html, /aria-label="Close"/);
    assert.match(html, />×</);
    assert.match(html, /absolute right-3 top-3/);
  });

  it("shows the empty state when nobody has called", () => {
    const html = renderToStaticMarkup(
      <RecentCallersList
        callers={[]}
        sending={false}
        onSendMessage={() => true}
      />,
    );

    assert.match(html, /Numbers that call the studio will appear here/);
    assert.doesNotMatch(html, />More</);
  });
});

describe("Admin message inbox photos", () => {
  it("includes inbound photos in the staff preview inbox", () => {
    const sample = buildPreviewStaffMessages();
    assert.equal(
      sample.recipients.some((item) => !hasStaffSmsRecipientIdentity(item)),
      true,
    );
    const photo = sample.inbox.find((item) => item.mediaUrls.length > 0);
    assert.ok(photo);
    assert.equal(photo?.body, "Photo");
    assert.deepEqual(photo?.mediaUrls, ["/logo.png"]);

    const source = readFileSync(
      new URL("./AdminMessageComposer.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /Customer photo/);
    assert.match(source, /staffSmsMediaProxyPath/);
    assert.match(source, /Import past photos/);
    assert.match(source, /backfill-photos/);
    assert.match(source, /hasStaffSmsRecipientIdentity/);
    assert.match(source, /Choose a customer, or type a number below/);
    assert.doesNotMatch(source, /item\.canText\)/);
  });
});
