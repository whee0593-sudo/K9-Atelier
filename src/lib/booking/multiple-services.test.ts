import assert from "node:assert/strict";
import { it } from "node:test";
import { toggleBookingServiceIds } from "../booking-flow";
import { quoteGuestBooking, guestBookingSelectionError } from "../booking-price";
import { creativeSelectionId, estimateServiceDurationMinutes } from "../services";
import { buildDefaultLineItems } from "../charges/line-items";
import { guestBookingStoredAddOnOptions } from "../appointments/stored-service-price";
import { readPricedAddOns } from "../charges/visit-line-items";
import type { AppointmentRecord } from "../appointments/types";

const ids = ["dematting-brush-out", "deshedding-treatment", "senior-comfort-care", "mini-trim", "creative-accent-coloring"];
const selection = { serviceId: "custom-full-haircut", addOnIds: ids, addOnOptions: { "creative-accent-coloring": "Temporary Fun" } };
it("accepts one primary service with more than four creative and care selections", () => {
  assert.equal(guestBookingSelectionError(selection), null);
});
it("prices selected extras and does not charge included care twice", () => {
  const result = quoteGuestBooking({ ...selection, weightLbs: 12, distanceMiles: 0 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(!result.quote.addOns.some(item => ["mini-trim"].includes(item.id)));
  assert.ok(result.quote.assessedAddOns.some(item => item.id === "dematting-brush-out"));
  assert.equal(result.quote.estimatedServicePrice, result.quote.servicePrice + result.quote.addOns.reduce((sum,item) => sum + item.price,0));
});
it("keeps only one primary across both categories while preserving all extras", () => {
 const primaries = ["signature-bath-care", "show-level-coat-care", "luxury-spa-day", "custom-full-haircut", "hand-stripping"];
 const extras = ["dematting-brush-out", "deshedding-treatment", "senior-comfort-care", "mini-trim", creativeSelectionId("Temporary Fun"), creativeSelectionId("Ears & Tail Accent")];
 for (const previous of primaries) for (const next of primaries) {
   if (previous === next) continue;
   assert.deepEqual(toggleBookingServiceIds([previous,...extras],next),[...extras,next]);
   assert.ok(guestBookingSelectionError({serviceId:previous,addOnIds:[next],addOnOptions:{}}));
 }
 assert.deepEqual(toggleBookingServiceIds([primaries[0],...extras],primaries[0]),extras);
 assert.deepEqual(toggleBookingServiceIds([primaries[0],...extras],extras[0]),[primaries[0],...extras.slice(1)]);
});
it("keeps all priced selections in staff billing line items", () => {
  const items = buildDefaultLineItems({ ...selection, serviceName: "Luxury Spa Day", travelFee:0, estimatedTotal:0 } as AppointmentRecord,12);
  for (const id of [selection.serviceId,"senior-comfort-care","creative-accent-coloring"]) assert.ok(items.some(item => item.catalogId === id));
});
it("rejects duplicate selections, unknown services, private services and unpriced creative options", () => {
  for (const addOnIds of [["signature-bath-care","signature-bath-care"],["not-real"],["end-of-life-care"]]) assert.ok(guestBookingSelectionError({...selection,addOnIds}));
  assert.ok(guestBookingSelectionError({...selection,addOnOptions:{"creative-accent-coloring":"Custom Creative Design"}}));
});
it("keeps the pet weight restriction on the selected primary service", () => {
  const result = quoteGuestBooking({ serviceId:"signature-bath-care", addOnIds:[],addOnOptions:{}, weightLbs:50,distanceMiles:0 });
  assert.equal(result.ok,false);
  if (!result.ok) assert.equal(result.code,"weight_limit");
});

it("replaces the creative choice while retaining the primary and all specialty care", () => {
 const a = creativeSelectionId("Temporary Fun");
 const b = creativeSelectionId("Ears & Tail Accent");
 const care = ["dematting-brush-out","deshedding-treatment","senior-comfort-care","mini-trim"];
 for (const primary of [[],["signature-bath-care"]]) {
   assert.deepEqual(toggleBookingServiceIds([...primary,...care,a],b),[...primary,...care,b]);
 }
 assert.ok(guestBookingSelectionError({serviceId:"signature-bath-care",addOnIds:[a,b],addOnOptions:{[a]:"Temporary Fun",[b]:"Ears & Tail Accent"}}));
});

it("preserves all priced services in the stored appointment snapshot", () => {
 const result = quoteGuestBooking({...selection,weightLbs:12,distanceMiles:0});
 assert.equal(result.ok,true);
 if (!result.ok) return;
 const stored = guestBookingStoredAddOnOptions(result.quote,selection.addOnOptions);
 assert.deepEqual(readPricedAddOns(stored).map(item => item.id),result.quote.addOns.map(item => item.id));
});
