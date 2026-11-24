import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import { geocodeAddress, geocodeBaseAddress, getDrivingRoute, resetGeoCache } from "./geo";

const originalKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
const legacyKey = process.env.GOOGLE_MAPS_API_KEY;
const from = { lat: 26.845, lon: -80.107 };
const to = { lat: 26.715, lon: -80.053 };

afterEach(() => {
  mock.restoreAll();
  resetGeoCache();
  if (originalKey == null) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
  else process.env.GOOGLE_MAPS_SERVER_API_KEY = originalKey;
  if (legacyKey == null) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = legacyKey;
});

it("uses and caches Google's verified base coordinates", async () => {
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "test-key";
  const fetchMock = mock.method(globalThis, "fetch", async (input: string) => {
    assert.equal(new URL(input).hostname, "maps.googleapis.com");
    return Response.json({ status: "OK", results: [{ geometry: {
      location_type: "ROOFTOP", location: { lat: from.lat, lng: from.lon },
    } }] });
  });
  assert.deepEqual(await geocodeBaseAddress("test address"), from);
  assert.deepEqual(await geocodeBaseAddress("test address"), from);
  assert.equal(fetchMock.mock.callCount(), 1);
});

it("reads directional miles and exact minutes from Google Routes", async () => {
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "test-key";
  mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    assert.equal(new URL(input).hostname, "routes.googleapis.com");
    assert.equal(JSON.parse(String(init.body)).travelMode, "DRIVE");
    assert.equal(new Headers(init.headers).get("X-Goog-FieldMask"), "routes.distanceMeters,routes.duration");
    return Response.json({ routes: [{ distanceMeters: 32186.88, duration: "900.6s" }] });
  });
  assert.deepEqual(await getDrivingRoute(from, to), { miles: 20, minutes: 15.01 });
});

it("does not fall back when Google refuses a lookup", async () => {
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "test-key";
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response(null, { status: 403 }));
  assert.equal(await getDrivingRoute(from, to), null);
  assert.equal(await geocodeAddress("test address"), null);
  assert.equal(fetchMock.mock.callCount(), 2);
});
