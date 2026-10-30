import assert from "node:assert/strict";
import { it } from "node:test";
import { emptyBookingServiceSelection, quoteAddedDogServices, toggleBookingServiceSelection } from "./service-selection";
import { getBookingCareCategories } from "../booking-flow";
import { getAddOnService } from "../services";
import { guestBookingStoredAddOnOptions } from "../appointments/stored-service-price";
import { readPricedAddOns } from "../charges/visit-line-items";

it("offers the same four service categories as the main booking for a 9 lb dog", () => {
  assert.deepEqual(getBookingCareCategories(9,{includeMembersOnly:true}).map(c=>c.id), ["bath-show-spa","full-grooming","creative-accent-coloring","specialty-add-on-care"]);
});
it("shares primary replacement, color replacement and care retention across booking entry points", () => {
  let selection = emptyBookingServiceSelection();
  for (const id of ["signature-bath-care","dematting-brush-out"]) selection=toggleBookingServiceSelection(selection,getAddOnService(id)!);
  selection=toggleBookingServiceSelection(selection,getAddOnService("creative-accent-coloring")!,"Temporary Fun");
  const extras=[...selection.addOnIds];
  selection=toggleBookingServiceSelection(selection,getAddOnService("custom-full-haircut")!);
  assert.equal(selection.serviceId,"custom-full-haircut");
  assert.deepEqual(selection.addOnIds,extras);
  selection=toggleBookingServiceSelection(selection,getAddOnService("creative-accent-coloring")!,"Ears & Tail Accent");
  assert.equal(selection.serviceId,"custom-full-haircut");
  assert.ok(selection.addOnIds.includes("dematting-brush-out"));
  assert.equal(selection.addOnIds.length,2);
  assert.deepEqual(Object.values(selection.addOnOptions),["Ears & Tail Accent"]);
  assert.equal(quoteAddedDogServices(selection,9).ok,true);
});
it("requires a primary and rejects unknown, retired, weight-ineligible and duplicate primary selections", () => {
  for(const selection of [
    {serviceId:"",addOnIds:["dematting-brush-out"],addOnOptions:{}},
    {serviceId:"creative-accent-coloring",addOnIds:[],addOnOptions:{}},
    {serviceId:"end-of-life-care",addOnIds:[],addOnOptions:{}},
    {serviceId:"signature-bath-care",addOnIds:["custom-full-haircut"],addOnOptions:{}},
    {serviceId:"signature-bath-care",addOnIds:["unknown"],addOnOptions:{}},
  ]) assert.equal(quoteAddedDogServices(selection,9).ok,false);
  assert.equal(quoteAddedDogServices({serviceId:"signature-bath-care",addOnIds:[],addOnOptions:{}},60).ok,false);
  assert.equal(quoteAddedDogServices({serviceId:"hand-stripping",addOnIds:["senior-comfort-care"],addOnOptions:{}},60).ok,false);
});
it("retains creative and assessed care pricing snapshots without charging included mini trim twice", () => {
  let selection=emptyBookingServiceSelection();
  for(const id of ["custom-full-haircut","mini-trim","dematting-brush-out"]) selection=toggleBookingServiceSelection(selection,getAddOnService(id)!);
  selection=toggleBookingServiceSelection(selection,getAddOnService("creative-accent-coloring")!,"Temporary Fun");
  const priced=quoteAddedDogServices(selection,9);
  assert.equal(priced.ok,true);
  if(!priced.ok) return;
  assert.equal(priced.quote.travelFee,0);
  assert.ok(!priced.quote.addOns.some(item=>item.id==="mini-trim"));
  assert.ok(priced.quote.assessedAddOns.some(item=>item.id==="dematting-brush-out"));
  const stored=guestBookingStoredAddOnOptions(priced.quote,selection.addOnOptions);
  assert.deepEqual(readPricedAddOns(stored)?.map(item=>item.id),priced.quote.addOns.map(item=>item.id));
  assert.equal(priced.quote.estimatedServicePrice,priced.quote.servicePrice+priced.quote.addOnPrice);
});
