import React from "react";
import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { confirmStaffBookingFromEmail } from "./confirm-customer-booking";
import { EmailAppointmentConfirmation, EMAIL_CONFIRMATION_SUCCESS } from "@/components/account/EmailAppointmentConfirmation";
import { POST } from "@/app/api/confirm-account/appointment/route";

type Loader = NonNullable<Parameters<typeof confirmStaffBookingFromEmail>[1]>;
const token = "a".repeat(64);

function loaderFixture(options: { error?: string; already?: boolean; writeError?: boolean; partial?: boolean } = {}) {
  const calls: Array<[string, unknown]> = [];
  const chain = {
    update(value: unknown) { calls.push(["update", value]); return chain; },
    eq(key: string, value: unknown) { calls.push([key, value]); return chain; },
    in(key: string, value: unknown) { calls.push([key, value]); return chain; },
    async select() { return { data: options.partial ? [{id:"first"}] : [{id:"first"},{id:"second"}], error: options.writeError ? {message:"write failed"} : null }; },
  };
  const load = (async (_token: string, payments: boolean) => {
    calls.push(["payments", payments]);
    if (options.error) return {ok:false,error:options.error};
    return { ok:true, admin:{from:(table: string) => {calls.push(["table",table]); return chain;}},
      row:{customer_id:"owner",confirmed_at:null,customer_confirmed_at:null},
      appointment:{visitId:null}, firstName:"", email:"",
      appointments:["first","second"].map((id) => ({id,status:options.already?"confirmed":"pending_confirmation",customerConfirmedAt:options.already?"2026-11-03":null})),
    };
  }) as unknown as Loader;
  return {load,calls};
}

it("confirms all authenticated visit siblings without password or payment operations", async () => {
  const fixture = loaderFixture();
  assert.deepEqual(await confirmStaffBookingFromEmail(token, fixture.load), {confirmed:true});
  assert.ok(fixture.calls.some(([key,value]) => key === "payments" && value === false));
  assert.ok(fixture.calls.some(([key,value]) => key === "customer_id" && value === "owner"));
  assert.deepEqual(fixture.calls.find(([key]) => key === "id")?.[1], ["first","second"]);
  const patch = fixture.calls.find(([key]) => key === "update")?.[1] as Record<string,unknown>;
  assert.equal(patch.status,"confirmed");
  assert.ok(patch.customer_confirmed_at);
  assert.ok(!("payment_method_id" in patch));
  assert.ok(!("customer_confirm_token_hash" in patch));
});

it("is idempotent and never reports success for invalid, expired, frozen or failed confirmations", async () => {
  const already = loaderFixture({already:true});
  assert.deepEqual(await confirmStaffBookingFromEmail(token,already.load),{confirmed:true});
  assert.ok(!already.calls.some(([key]) => key === "update"));
  const invalid = loaderFixture();
  assert.deepEqual(await confirmStaffBookingFromEmail("invalid",invalid.load),{error:"not_found"});
  assert.equal(invalid.calls.length,0);
  for (const error of ["expired","frozen","not_found","server"]) {
    const fixture=loaderFixture({error});
    assert.deepEqual(await confirmStaffBookingFromEmail(token,fixture.load),{ok:false,error});
    assert.ok(!fixture.calls.some(([key]) => key === "update"));
  }
  for (const options of [{writeError:true},{partial:true}]) {
    const fixture=loaderFixture(options);
    assert.deepEqual(await confirmStaffBookingFromEmail(token,fixture.load),{error:"server"});
  }
});

it("shows the exact success copy only in the confirmed state", () => {
  const loading = renderToStaticMarkup(<EmailAppointmentConfirmation token="invalid" />);
  assert.match(loading,/Confirming your appointment/);
  assert.ok(!loading.includes(EMAIL_CONFIRMATION_SUCCESS));
  const success = renderToStaticMarkup(<EmailAppointmentConfirmation token="preview" preview />);
  assert.ok(success.includes("Your appointment is confirmed! See you soon.💜"));
  assert.doesNotMatch(success,/password|payment|profile/i);
});

it("the public POST endpoint rejects malformed tokens without reporting confirmation", async () => {
  const response=await POST(new Request("https://k9atelier.com/api/confirm-account/appointment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:"invalid"})}));
  assert.equal(response.status,404);
  assert.deepEqual(await response.json(),{error:"This confirmation link is not valid."});
});
