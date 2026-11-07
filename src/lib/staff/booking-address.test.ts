import assert from "node:assert/strict";
import { it } from "node:test";
import { hasServiceAddress, appointmentNeedsAddress } from "./booking-address";
import { staffBookingLocation } from "./booking-location";
import { buildStaffCreatedBookingEmail, buildStaffCreatedBookingSms } from "./customer-booking-copy";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import { POST } from "@/app/api/confirm-account/address/route";

it("reserves missing and partial addresses without geocoding or inventing coordinates", async () => {
  const unexpected = async () => { throw new Error("Must not geocode an incomplete address"); };
  for (const address of [null, {street:"",city:"",state:"FL",zip:""}, {street:"123 Palm Lane",city:"",state:"FL",zip:""}]) {
    assert.equal(hasServiceAddress(address), false);
    const location = await staffBookingLocation(address, {getBaseGeoPoint:unexpected,geocodeAddress:unexpected,drivingDistanceMiles:unexpected});
    assert.ok(!("error" in location));
    assert.equal(location.destination,null);
    assert.equal(location.quote.fee,0);
  }
});
it("prices a completed address using driving distance and rejects unlocatable addresses", async () => {
  const address = {street:"123 Palm Lane",city:"Jupiter",state:"FL",zip:"33458"};
  const deps = {getBaseGeoPoint:async()=>({lat:26,lon:-80}),geocodeAddress:async()=>({lat:26.5,lon:-80}),drivingDistanceMiles:async()=>15};
  const result = await staffBookingLocation(address,deps);
  assert.ok(!("error" in result));
  assert.equal(result.quote.distanceMiles,15);
  assert.ok(result.quote.fee > 0);
  assert.equal((await staffBookingLocation(address,{...deps,geocodeAddress:async()=>null}) as {error:string}).error,"outside_area");
});
it("email and SMS include an address completion link and mark travel as pending", () => {
  const appointment = {...buildPreviewCollectContext().appointment,addressStreet:"",addressCity:"",addressState:"FL",addressZip:""};
  assert.equal(appointmentNeedsAddress(appointment),true);
  const notice = {firstName:"Ada",confirmUrl:"https://k9atelier.com/confirm-account?token=example",createdAccount:false};
  const email = buildStaffCreatedBookingEmail(appointment,notice);
  assert.match(email.text,/confirm-account\?token=example/);
  assert.doesNotMatch(email.text,/confirm-account\/appointment/);
  assert.match(email.text,/Travel fee to be calculated/);
  assert.match(buildStaffCreatedBookingSms(appointment,notice.confirmUrl),/Please add your service address.*confirm-account\?token=example/);
});
it("rejects malformed address submissions and invalid tokens without database writes", async () => {
  for (const body of [{token:"bad",address:{street:"1 Main",city:"Jupiter",state:"FL",zip:"33458"}},{token:"a".repeat(64),address:{street:"",city:"",state:"FL",zip:""}}]) {
    const response = await POST(new Request("https://k9atelier.com/api/confirm-account/address",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));
    assert.ok(response.status >= 400);
  }
});
