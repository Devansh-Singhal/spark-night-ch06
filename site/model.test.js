import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateSavings, readSimulatorUrl } from "./model.js";

test("the stage example is 600 affected parts × ₹400 × 30%", () => {
  assert.deepEqual(estimateSavings({ volume: 60000, rate: 1, cost: 400, share: 30 }), {
    annual: 72000, low: 36000, high: 108000, lowShare: 15, highShare: 45,
  });
});

test("fractional rates and zero volume use the same arithmetic", () => {
  assert.deepEqual(estimateSavings({ volume: 10000, rate: 0.5, cost: 200, share: 25 }), {
    annual: 2500, low: 1000, high: 4000, lowShare: 10, highShare: 40,
  });
  assert.equal(estimateSavings({ volume: 0, rate: 1, cost: 400, share: 30 }).annual, 0);
});

test("sensitivity never extends below 0% or above 100%", () => {
  assert.equal(estimateSavings({ volume: 10, rate: 10, cost: 200, share: 5 }).low, 0);
  assert.equal(estimateSavings({ volume: 10, rate: 10, cost: 200, share: 95 }).high, 200);
});

test("the simulator URL supports a standalone app and a same-origin route", () => {
  assert.equal(readSimulatorUrl(""), "");
  assert.equal(readSimulatorUrl("/replay/?scenario=missed"), "/replay/?scenario=missed");
  assert.equal(readSimulatorUrl("http://127.0.0.1:5180/replay"), "http://127.0.0.1:5180/replay");
  assert.throws(() => readSimulatorUrl("javascript:alert(1)"));
  assert.throws(() => readSimulatorUrl("//example.com"));
  assert.throws(() => readSimulatorUrl("/\\example.com"));
  assert.throws(() => readSimulatorUrl("/\t/example.com"));
});
