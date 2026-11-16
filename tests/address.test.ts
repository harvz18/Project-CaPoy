import assert from "node:assert/strict";
import test from "node:test";
import { parseNominatimReverseResponse, parseNominatimSearchResponse } from "../src/services/reverseGeocoding";
import { formatAddressDetails, formatTaskAddressDetails, normalizeAddressDetails } from "../src/utils/address";

test("address details produce a concise human-readable address without requiring a house number", () => {
  assert.equal(formatAddressDetails({
    street: "  Rizal Street ", barangay: "Villamonte", city: "Bacolod", province: "Negros Occidental", postalCode: "6100"
  }), "Rizal Street, Villamonte, Bacolod, Negros Occidental, 6100");
  assert.deepEqual(normalizeAddressDetails({ houseNumber: " ", city: "  Bacolod City " }), { city: "Bacolod City" });
  assert.equal(formatTaskAddressDetails({
    street: "Rizal Street", barangay: "Villamonte", city: "Bacolod City", province: "Negros Occidental", postalCode: "6100"
  }), "Rizal Street, Villamonte, Bacolod City");
});

test("structured addresses retain PSGC hierarchy values while rendering legacy-compatible text", () => {
  const address = {
    region: "Region VI (Western Visayas)", regionCode: "0600000000",
    province: "Negros Occidental", provinceCode: "0645000000",
    cityMunicipality: "City of Bacolod", cityMunicipalityCode: "0645010000",
    barangay: "Barangay 12", barangayCode: "0645010012", street: "Rizal Street"
  };
  assert.equal(formatAddressDetails(address), "Rizal Street, Barangay 12, City of Bacolod, Negros Occidental, Region VI (Western Visayas)");
  assert.equal(address.cityMunicipalityCode, "0645010000");
});

test("an explicit barangay from Nominatim takes priority over a nearby locality", () => {
  const result = parseNominatimReverseResponse({
    display_name: "Father Mauricio Ferrero Street, Barangay 12, Malipaypon, Bacolod, Negros Occidental, 6100, Philippines",
    address: {
      road: "Father Mauricio Ferrero Street", city_district: "Barangay 12", village: "Malipaypon", city: "Bacolod"
    }
  });
  assert.equal(result?.details.barangay, "Barangay 12");
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

test("a selected Nominatim search result provides both a pin and address fields", () => {
  const result = parseNominatimSearchResponse({
    lat: "10.6742", lon: "122.9516",
    display_name: "Alijis Road, Alijis, Bacolod, Negros Occidental, 6100, Philippines",
    address: {
      road: "Alijis Road", village: "Alijis", city: "Bacolod", state: "Negros Occidental", postcode: "6100"
    }
  });
  assert.deepEqual(result, {
    coordinate: { latitude: 10.6742, longitude: 122.9516 },
    formattedAddress: "Alijis Road, Alijis, Bacolod, Negros Occidental, 6100, Philippines",
    details: { street: "Alijis Road", barangay: "Alijis", city: "Bacolod", province: "Negros Occidental", postalCode: "6100" },
    provider: "OpenStreetMap Nominatim"
  });
});
