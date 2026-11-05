import assert from "node:assert/strict";
import test from "node:test";
import { parseNominatimReverseResponse } from "../src/services/reverseGeocoding";
import { formatAddressDetails, normalizeAddressDetails } from "../src/utils/address";

test("address details produce a concise human-readable address without requiring a house number", () => {
  assert.equal(formatAddressDetails({
    street: "  Rizal Street ", barangay: "Villamonte", city: "Bacolod", province: "Negros Occidental", postalCode: "6100"
  }), "Rizal Street, Villamonte, Bacolod, Negros Occidental, 6100");
  assert.deepEqual(normalizeAddressDetails({ houseNumber: " ", city: "  Bacolod City " }), { city: "Bacolod City" });
});

test("a Nominatim reverse response becomes a reviewable address suggestion", () => {
  const result = parseNominatimReverseResponse({
    display_name: "12 Rizal Street, Villamonte, Bacolod, Negros Occidental, 6100, Philippines",
    address: {
      house_number: "12", road: "Rizal Street", village: "Villamonte", city: "Bacolod",
      state: "Negros Occidental", postcode: "6100"
    }
  });
  assert.deepEqual(result, {
    formattedAddress: "12 Rizal Street, Villamonte, Bacolod, Negros Occidental, 6100, Philippines",
    details: {
      houseNumber: "12", street: "Rizal Street", barangay: "Villamonte", city: "Bacolod", province: "Negros Occidental", postalCode: "6100"
    },
    provider: "OpenStreetMap Nominatim"
  });
});
