import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  GOOGLE_ADS_BOOK_CONVERSION_SEND_TO,
  GOOGLE_ADS_BOOK_CONVERSION_STORAGE_KEY,
  hasTrackedGoogleAdsBookingConversion,
  resetGoogleAdsBookingConversionTrackingForTests,
  trackGoogleAdsBookingConversion,
} from "./google-ads";

type GtagCall = unknown[];

function installBrowser(options?: { gtag?: (...args: unknown[]) => void }) {
  const store = new Map<string, string>();
  const gtagCalls: GtagCall[] = [];
  const gtag =
    options && "gtag" in options
      ? options.gtag
      : (...args: unknown[]) => {
          gtagCalls.push(args);
        };

  const windowObj = {
    localStorage: {
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
    },
    gtag,
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowObj,
  });

  return { gtagCalls, windowObj, store };
}

function conversionCalls(gtagCalls: GtagCall[]) {
  return gtagCalls.filter(
    (call) => call[0] === "event" && call[1] === "conversion",
  );
}

afterEach(() => {
  resetGoogleAdsBookingConversionTrackingForTests();
  delete (globalThis as { window?: unknown }).window;
});

describe("trackGoogleAdsBookingConversion", () => {
  it("sends the Book appointment conversion with the exact send_to", () => {
    const { gtagCalls } = installBrowser();

    trackGoogleAdsBookingConversion("apt-123");

    assert.deepEqual(conversionCalls(gtagCalls), [
      [
        "event",
        "conversion",
        {
          send_to: "AW-18402037044/x65RCOrWw-UcELSa48ZE",
          transaction_id: "apt-123",
        },
      ],
    ]);
    assert.equal(
      GOOGLE_ADS_BOOK_CONVERSION_SEND_TO,
      "AW-18402037044/x65RCOrWw-UcELSa48ZE",
    );
    assert.equal(hasTrackedGoogleAdsBookingConversion("apt-123"), true);
  });

  it("records the appointment ID and does not send again", () => {
    const { gtagCalls } = installBrowser();

    trackGoogleAdsBookingConversion("apt-123");
    trackGoogleAdsBookingConversion("apt-123");

    assert.equal(conversionCalls(gtagCalls).length, 1);
    assert.deepEqual(
      JSON.parse(
        globalThis.window.localStorage.getItem(
          GOOGLE_ADS_BOOK_CONVERSION_STORAGE_KEY,
        ) ?? "[]",
      ),
      ["apt-123"],
    );
  });

  it("does not fire without an appointment ID", () => {
    const { gtagCalls } = installBrowser();

    trackGoogleAdsBookingConversion("   ");

    assert.equal(conversionCalls(gtagCalls).length, 0);
  });

  it("does not fire before gtag is ready, then sends once", async () => {
    const { gtagCalls, windowObj } = installBrowser({ gtag: undefined });

    trackGoogleAdsBookingConversion("apt-late");
    assert.equal(conversionCalls(gtagCalls).length, 0);

    windowObj.gtag = (...args: unknown[]) => {
      gtagCalls.push(args);
    };

    await new Promise((resolve) => setTimeout(resolve, 300));

    assert.equal(conversionCalls(gtagCalls).length, 1);
    assert.deepEqual(conversionCalls(gtagCalls)[0]?.[2], {
      send_to: "AW-18402037044/x65RCOrWw-UcELSa48ZE",
      transaction_id: "apt-late",
    });
  });
});
