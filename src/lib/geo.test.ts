import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import {
  drivingDistanceMiles,
  geocodeAddress,
  geocodeBaseAddress,
  isGoogleMapsConfigured,
  resetGeoCache,
} from "./geo";

const originalKey = process.env.GOOGLE_MAPS_API_KEY;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function headerValue(init: RequestInit | undefined, name: string) {
  const headers = init?.headers;
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return match?.[1] ?? null;
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find(
    (entry) => entry.toLowerCase() === name.toLowerCase(),
  );
  return key ? record[key] : null;
}

afterEach(() => {
  mock.restoreAll();
  resetGeoCache();
  if (originalKey === undefined) {
    delete process.env.GOOGLE_MAPS_API_KEY;
  } else {
    process.env.GOOGLE_MAPS_API_KEY = originalKey;
  }
});

describe("Google Maps travel quotes", () => {
  it("geocodes with Google when GOOGLE_MAPS_API_KEY is set", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-maps-key";
    assert.equal(isGoogleMapsConfigured(), true);

    const fetchMock = mock.method(globalThis, "fetch", async (input) => {
      const url = requestUrl(input);
      assert.match(url, /maps\.googleapis\.com\/maps\/api\/geocode\/json/);
      assert.match(url, /key=test-maps-key/);
      assert.match(url, /components=country%3AUS/);
      assert.doesNotMatch(url, /nominatim/);
      return jsonResponse({
        status: "OK",
        results: [
          { geometry: { location: { lat: 26.8234, lng: -80.1386 } } },
        ],
      });
    });

    const point = await geocodeAddress(
      "10800 N Military Trl, Palm Beach Gardens, FL 33410",
    );

    assert.deepEqual(point, { lat: 26.8234, lon: -80.1386 });
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it("returns null when Google Geocoding denies the key", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-maps-key";
    mock.method(globalThis, "fetch", async () =>
      jsonResponse({
        status: "REQUEST_DENIED",
        error_message: "This API project is not authorized to use this API.",
      }),
    );

    const point = await geocodeAddress("1 Main St, Jupiter, FL 33458");
    assert.equal(point, null);
  });

  it("computes driving miles with Routes API traffic-unaware distance", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-maps-key";

    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async (input, init) => {
        const url = requestUrl(input);
        assert.equal(
          url,
          "https://routes.googleapis.com/directions/v2:computeRoutes",
        );
        assert.equal(headerValue(init, "X-Goog-Api-Key"), "test-maps-key");
        assert.equal(headerValue(init, "X-Goog-FieldMask"), "routes.distanceMeters");
        const body = JSON.parse(String(init?.body)) as {
          travelMode?: string;
          routingPreference?: string;
        };
        assert.equal(body.travelMode, "DRIVE");
        assert.equal(body.routingPreference, "TRAFFIC_UNAWARE");
        return jsonResponse({ routes: [{ distanceMeters: 24140.16 }] });
      },
    );

    const miles = await drivingDistanceMiles(
      { lat: 26.82, lon: -80.14 },
      { lat: 26.93, lon: -80.1 },
    );

    assert.equal(miles, 15);
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it("does not fall back to OpenStreetMap while a Maps key is configured", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-maps-key";
    mock.method(globalThis, "fetch", async () =>
      jsonResponse({ status: "ZERO_RESULTS", results: [] }),
    );

    const point = await geocodeAddress("not-a-real-street, FL 00000");
    assert.equal(point, null);
  });
});

describe("OpenStreetMap fallback", () => {
  it("uses Nominatim and OSRM when no Maps key is set", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    assert.equal(isGoogleMapsConfigured(), false);

    const urls: string[] = [];
    mock.method(globalThis, "fetch", async (input) => {
      const url = requestUrl(input);
      urls.push(url);
      if (url.includes("nominatim.openstreetmap.org")) {
        return jsonResponse([{ lat: "26.7", lon: "-80.05" }]);
      }
      if (url.includes("router.project-osrm.org")) {
        return jsonResponse({ code: "Ok", routes: [{ distance: 16093.44 }] });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const point = await geocodeAddress("100 Olive Ave, West Palm Beach, FL 33401");
    const miles = await drivingDistanceMiles(point!, {
      lat: 26.82,
      lon: -80.14,
    });

    assert.deepEqual(point, { lat: 26.7, lon: -80.05 });
    assert.equal(miles, 10);
    assert.equal(urls.length, 2);
    assert.match(urls[0]!, /nominatim\.openstreetmap\.org/);
    assert.match(urls[1]!, /router\.project-osrm\.org/);
  });
});

describe("geocodeBaseAddress", () => {
  it("reuses the first lookup", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      jsonResponse([{ lat: "26.8", lon: "-80.1" }]),
    );

    const first = await geocodeBaseAddress("Palm Beach Gardens, FL");
    const second = await geocodeBaseAddress("Palm Beach Gardens, FL");

    assert.deepEqual(first, { lat: 26.8, lon: -80.1 });
    assert.equal(second, first);
    assert.equal(fetchMock.mock.callCount(), 1);
  });
});
