import React from "react";
import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TravelFeeControl } from "./TravelFeeControl";

it("shows automatic calculation as the default without a custom amount", () => {
  const html = renderToStaticMarkup(<TravelFeeControl automatic={33} value={null} onChange={() => {}} />);
  assert.match(html, /Automatic amount:.*\$33/);
  assert.match(html, /Automatic calculation active/);
  assert.doesNotMatch(html, /type="number"/);
  assert.match(html, /Charged once per visit/);
});
it("makes a zero waiver, its automatic amount and the restore action visible", () => {
  const html = renderToStaticMarkup(<TravelFeeControl automatic={33} value="0" onChange={() => {}} />);
  assert.match(html, /value="0"/);
  assert.match(html, /Manual override active/);
  assert.match(html, /Restore automatic calculation/);
  assert.match(html, /Automatic amount:.*\$33/);
  assert.match(html, /step="0.01"/);
});
