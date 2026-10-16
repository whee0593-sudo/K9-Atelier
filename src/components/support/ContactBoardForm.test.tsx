import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactBoardForm } from "@/components/support/ContactBoardForm";

describe("Contact Us form", () => {
  it("asks for an optional email and an optional phone instead of one combined field", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContactBoardForm, { initialInquiry: "general" }),
    );

    assert.match(html, /Email Address/);
    assert.match(html, /Phone Number/);
    assert.match(html, /\(Optional\)/);
    assert.match(html, /id="board-email"/);
    assert.match(html, /id="board-phone"/);
    assert.match(html, /type="email"/);
    assert.match(html, /type="tel"/);
    assert.match(html, /Inquiry Type/);
    assert.match(html, /Subject/);
    assert.match(html, /Message/);
    assert.match(html, /Add photos/);
    assert.match(html, /Email address, phone number, or both/);
    assert.equal(html.includes("Email or phone number"), false);
    assert.equal(html.includes('id="board-contact"'), false);
    assert.equal(html.includes("required"), false);
  });

  it("does not wire the form to SMS", () => {
    const source = readFileSync(
      new URL("./ContactBoardForm.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(source.includes("sendSms"), false);
    assert.equal(source.includes("twilio"), false);
    assert.equal(source.includes('body.set("email"'), true);
    assert.equal(source.includes('body.set("phone"'), true);
    assert.equal(source.includes('body.set("contact"'), false);
  });
});
