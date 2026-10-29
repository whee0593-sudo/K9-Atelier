import assert from "node:assert/strict";
import { it } from "node:test";
import { quoteGuestBooking, guestBookingSelectionError } from "../booking-price";
import { creativeSelectionId, estimateServiceDurationMinutes } from "../services";
import { buildDefaultLineItems } from "../charges/line-items";
import { guestBookingStoredAddOnOptions } from "../appointments/stored-service-price";
import { readPricedAddOns } from "../charges/visit-line-items";
import type { AppointmentRecord } from "../appointments/types";

const ids = ["signature-bath-care", "show-level-coat-care", "custom-full-haircut", "hand-stripping", "dematting-brush-out", "deshedding-treatment", "senior-comfort-care", "mini-trim", "creative-accent-coloring"];
const selection = { serviceId: "luxury-spa-day", addOnIds: ids, addOnOptions: { "creative-accent-coloring": "Temporary Fun" } };
it("accepts more than one primary service and more than four simultaneous choices", () => {
  assert.equal(guestBookingSelectionError(selection), null);
});
it("prices all selected primary services and does not charge included care twice", () => {
  const result = quoteGuestBooking({ ...selection, weightLbs: 12, distanceMiles: 0 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const id of ids.slice(0,4)) assert.ok(result.quote.addOns.some(item => item.id === id));
  assert.ok(!result.quote.addOns.some(item => ["mini-trim", "deshedding-treatment"].includes(item.id)));
  assert.ok(result.quote.assessedAddOns.some(item => item.id === "dematting-brush-out"));
  assert.equal(result.quote.estimatedServicePrice, result.quote.servicePrice + result.quote.addOns.reduce((sum,item) => sum + item.price,0));
});
it("includes every additional primary service in the scheduled duration", () => {
  const primaries = ids.slice(0,4);
  assert.equal(estimateServiceDurationMinutes(selection.serviceId,12,primaries), [selection.serviceId,...primaries].reduce((sum,id) => sum + estimateServiceDurationMinutes(id,12),0));
});
it("keeps all priced selections in staff billing line items", () => {
  const items = buildDefaultLineItems({ ...selection, serviceName: "Luxury Spa Day", travelFee:0, estimatedTotal:0 } as AppointmentRecord,12);
  for (const id of [selection.serviceId,...ids.slice(0,4),"senior-comfort-care","creative-accent-coloring"]) assert.ok(items.some(item => item.catalogId === id));
});
it("rejects duplicate selections, unknown services, private services and unpriced creative options", () => {
  for (const addOnIds of [["signature-bath-care","signature-bath-care"],["not-real"],["end-of-life-care"]]) assert.ok(guestBookingSelectionError({...selection,addOnIds}));
  assert.ok(guestBookingSelectionError({...selection,addOnOptions:{"creative-accent-coloring":"Custom Creative Design"}}));
});
it("applies the pet weight restriction to additional primary services", () => {
  const result = quoteGuestBooking({ serviceId:"hand-stripping", addOnIds:["signature-bath-care"],addOnOptions:{}, weightLbs:50,distanceMiles:0 });
  assert.equal(result.ok,false);
  if (!result.ok) assert.equal(result.code,"weight_limit");
});

it("allows several creative options together and prices every option separately", () => {
 const a = creativeSelectionId("Temporary Fun");
 const b = creativeSelectionId("Ears & Tail Accent");
 const result = quoteGuestBooking({serviceId:"signature-bath-care",weightLbs:12,distanceMiles:0,addOnIds:[a,b],addOnOptions:{[a]:"Temporary Fun",[b]:"Ears & Tail Accent"}});
 assert.equal(result.ok,true);
 if (!result.ok) return;
 assert.deepEqual(result.quote.addOns.map(item => item.id),[a,b]);
 assert.equal(result.quote.addOnPrice,150);
});

it("preserves all priced services in the stored appointment snapshot", () => {
 const result = quoteGuestBooking({...selection,weightLbs:12,distanceMiles:0});
 assert.equal(result.ok,true);
 if (!result.ok) return;
 const stored = guestBookingStoredAddOnOptions(result.quote,selection.addOnOptions);
 assert.deepEqual(readPricedAddOns(stored).map(item => item.id),result.quote.addOns.map(item => item.id));
});
