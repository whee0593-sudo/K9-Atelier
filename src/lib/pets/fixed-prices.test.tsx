import React from "react";
import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { fixedPriceForService, mapFixedServicePrices, parseFixedServicePrice } from "./fixed-prices";
import { mapPetRowToRecord, mapPetRecordToUiProfile, mapPetProfileToWriteInput } from "./map";
import { quoteGuestBooking, evaluateSubmittedBookingPrice } from "@/lib/booking-price";
import { guestBookingStoredServicePrice } from "@/lib/appointments/stored-service-price";
import { staffAppointmentPriceDrafts } from "@/lib/staff/staff-appointment-drafts";
import { StaffPetFixedPrices } from "@/components/admin/StaffPetFixedPrices";
import type { PetRow } from "./types";
Object.assign(globalThis, { React });
const id = "custom-full-haircut";
const input = { serviceId:id, weightLbs:18, addOnIds:[], addOnOptions:{}, distanceMiles:0 };

it("prices each dog independently and freezes the booked price", () => {
  const prices = {[id]:200};
  const stella = quoteGuestBooking({...input, fixedServicePrices:prices});
  const valentino = quoteGuestBooking({...input, fixedServicePrices:{[id]:180}});
  assert.ok(stella.ok && valentino.ok); if (!stella.ok || !valentino.ok) return;
  assert.equal(stella.quote.servicePrice,200); assert.equal(valentino.quote.servicePrice,180);
  assert.equal(stella.quote.pricingBasis,"fixed"); assert.doesNotMatch(stella.quote.servicePriceLabel,/From/);
  const booked = guestBookingStoredServicePrice(stella.quote); prices[id] = 220;
  assert.equal(booked,200); assert.equal(stella.quote.estimatedTotal,200);
});
it("keeps other services standard and adds add-ons and travel separately", () => {
  assert.deepEqual(quoteGuestBooking({...input,serviceId:"signature-bath-care",fixedServicePrices:{[id]:200}}), quoteGuestBooking({...input,serviceId:"signature-bath-care"}));
  const result = quoteGuestBooking({...input,addOnIds:["deshedding-treatment"],distanceMiles:20,fixedServicePrices:{[id]:200}});
  assert.ok(result.ok); if (!result.ok) return;
  assert.ok(result.quote.addOnPrice > 0); assert.ok(result.quote.travelFee > 0);
  assert.equal(result.quote.estimatedTotal,200 + result.quote.addOnPrice + result.quote.travelFee);
});
it("accepts zero, restores standard prices and rejects invalid or hourly overrides", () => {
  const zero = quoteGuestBooking({...input,fixedServicePrices:{[id]:0}});
  assert.ok(zero.ok); if (zero.ok) assert.equal(zero.quote.servicePrice,0);
  for (const amount of [-1,5000.01,NaN,Infinity,"200",true,200.001]) assert.equal(parseFixedServicePrice({serviceId:id,amount}),null);
  assert.deepEqual(parseFixedServicePrice({serviceId:id,amount:null}),{serviceId:id,amount:null});
  assert.equal(parseFixedServicePrice({serviceId:"hand-stripping",amount:200}),null);
  assert.equal(parseFixedServicePrice({serviceId:"dematting-brush-out",amount:25}),null);
  assert.equal(fixedPriceForService({"hand-stripping":1},"hand-stripping"),null);
});
it("validates the submitted total against the server's stored fixed price", () => {
  const result = evaluateSubmittedBookingPrice({...input,estimatedTotal:1},18,{[id]:200});
  assert.equal(result.ok,false); if (!result.ok) { assert.equal(result.code,"price_changed"); assert.equal(result.quote?.estimatedTotal,200); }
  assert.equal(evaluateSubmittedBookingPrice({...input,estimatedTotal:200},18,{[id]:200}).ok,true);
});
it("loads fixed prices into booking profiles without allowing customer pet writes", () => {
  const row = {id:"pet",name:"Stella",breed:"Poodle",weight_lbs:18,pet_service_prices:[{service_id:id,amount:"200.00"}]} as PetRow;
  const profile = mapPetRecordToUiProfile(mapPetRowToRecord(row));
  assert.equal(profile.fixedServicePrices?.[id],200);
  assert.equal("fixedServicePrices" in mapPetProfileToWriteInput(profile),false);
  assert.deepEqual(mapFixedServicePrices([{service_id:id,amount:null}]),{});
});
it("uses fixed prices for staff multi-dog booking and charges travel once", () => {
  const pet = {weightLbs:18,serviceIds:[id],serviceOptionNames:[null],servicePrices:[null],addOnIds:[],addOnOptions:{}};
  const result = staffAppointmentPriceDrafts([{...pet,fixedServicePrices:{[id]:200}},{...pet,fixedServicePrices:{[id]:180}}],15);
  assert.ok(result.ok); if (!result.ok) return;
  assert.deepEqual(result.drafts.map(d=>d.servicePrice),[200,180]);
  assert.deepEqual(result.drafts.map(d=>d.estimatedTotal),[215,180]);
});
it("shows the saved price and standard-pricing option in the staff pet profile", () => {
  const html = renderToStaticMarkup(<StaffPetFixedPrices customerId="owner" petId="pet" prices={{[id]:200}} onSaved={()=>{}} />);
  assert.match(html,/Fixed service prices/); assert.match(html,/value="custom-full-haircut"/); assert.match(html,/\$200\.00/);
  assert.match(html,/Save fixed price/); assert.match(html,/Use standard pricing/);
});
