import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppointmentReviewPanel } from "@/components/admin/AppointmentReviewPanel";

describe("appointment review page", () => {
  it("does not keep a vaccination review queue under the calendar", () => {
    const html = renderToStaticMarkup(<AppointmentReviewPanel preview />);

    assert.match(html, /Route days/);
    assert.match(html, /Today — drive order/);
    assert.equal(html.includes("Approve booking"), false);
    assert.equal(html.includes("Decline"), false);
    assert.equal(html.includes("Review vaccinations"), false);
    assert.equal(html.includes("Pending staff review"), false);
    assert.equal(html.includes("waiting for staff review"), false);
    assert.equal(html.includes("All caught up"), false);
  });
});
