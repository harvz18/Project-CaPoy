import assert from "node:assert/strict";
import test from "node:test";
import { fetchBacolodBarangays, normalizeBacolodBarangayName, parseBacolodBarangays } from "../src/services/bacolodBarangayService";

test("Bacolod barangay data is normalized from a live boundary response without a bundled fallback list", () => {
  assert.equal(normalizeBacolodBarangayName("Alijis"), "Barangay Alijis");
  assert.equal(normalizeBacolodBarangayName("Barangay 10"), "Barangay 10");
  assert.deepEqual(parseBacolodBarangays({ elements: [{ tags: { name: "Alijis" } }, { tags: { name: "Barangay 10" } }, { tags: { name: "Alijis" } }] }), ["Barangay 10", "Barangay Alijis"]);
});

test("Bacolod barangays use a second live-map endpoint when the first endpoint is unavailable", async () => {
  const endpoints: string[] = [];
  const fetcher = async (input: string) => {
    endpoints.push(input);
    if (endpoints.length === 1) throw new Error("temporary network failure");
    return new Response(JSON.stringify({ elements: [{ tags: { name: "Alijis" } }] }), { status: 200 });
  };
  assert.deepEqual(await fetchBacolodBarangays(fetcher as typeof fetch), ["Barangay Alijis"]);
  assert.equal(endpoints.length, 2);
});
