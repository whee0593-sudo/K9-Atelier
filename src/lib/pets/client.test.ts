import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMER_PET_CREATED_EVENT, createCustomerPet, fetchCustomerPets } from "./client";

test("saving an added dog persists its profile before notifying other pet lists", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const events: CustomEvent[] = [];
  const record = { id: "267dc2ea-1388-4e50-bc35-03aed3a18950", name: "Yoyo", breed: "Doodle", weightLbs: 10 };
  try {
    globalThis.window = { dispatchEvent: (event: CustomEvent) => { events.push(event); return true; } } as unknown as Window & typeof globalThis;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/api/pets");
      if (options?.method === "POST") {
        assert.equal(options.credentials, "include");
        assert.deepEqual(JSON.parse(String(options.body)), { name: "Yoyo", breed: "Doodle", weightLbs: 10 });
        assert.equal(events.length, 0);
        return Response.json({ pet: record }, { status: 201 });
      }
      assert.equal(options?.cache, "no-store");
      return Response.json({ pets: [record] });
    };
    const saved = await createCustomerPet({ name: "Yoyo", breed: "Doodle", weightLbs: 10 });
    assert.equal(saved.weightLbs, 10);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, CUSTOMER_PET_CREATED_EVENT);
    assert.equal(events[0].detail.id, saved.id);
    const pets = await fetchCustomerPets();
    assert.equal(pets[0].id, saved.id);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});

test("a rejected pet save does not publish a saved profile", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ error: "Could not save this pet profile." }, { status: 409 });
    await assert.rejects(createCustomerPet({ name: "Yoyo", breed: "Doodle", weightLbs: 10 }), /Could not save/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
