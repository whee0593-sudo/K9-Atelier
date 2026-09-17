import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CustomerRecordNotesButton,
  CustomerRecordNotesDialog,
} from "@/components/admin/CustomerRecordNotesButton";

const noop = () => undefined;

describe("Customer record notes", () => {
  it("renders a button instead of a registered-accounts link", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordNotesButton customerId="11111111-1111-4111-8111-111111111111" />,
    );

    assert.match(html, />Customer record</);
    assert.match(html, /<button[^>]*>Customer record<\/button>/);
    assert.doesNotMatch(html, /\/admin\/pets/);
    assert.doesNotMatch(html, /Registered Accounts/);
  });

  it("renders a blank textarea, save button, and close control", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordNotesDialog
        open
        notes=""
        onNotesChange={noop}
        onClose={noop}
        onSave={noop}
      />,
    );

    assert.match(html, /role="dialog"/);
    assert.match(html, /<textarea/);
    assert.match(html, />Save</);
    assert.match(html, /aria-label="Close"/);
    assert.match(html, />×</);
    assert.doesNotMatch(html, /\/admin\/pets/);
    assert.doesNotMatch(html, /Registered Accounts/);
  });

  it("wires completed-bill actions to the notes dialog", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/admin/AppointmentActionLinks.tsx"),
      "utf8",
    );
    assert.match(source, /CustomerRecordNotesButton/);
    assert.doesNotMatch(source, /\/admin\/pets\?customer=/);
  });
});
