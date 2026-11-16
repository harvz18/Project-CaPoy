export type AddressDetails = {
  region?: string;
  regionCode?: string;
  houseNumber?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  provinceCode?: string;
  cityMunicipality?: string;
  cityMunicipalityCode?: string;
  postalCode?: string;
  barangayCode?: string;
};

export function formatAddressDetails(details: AddressDetails) {
  const streetLine = [details.houseNumber, details.street].map(clean).filter(Boolean).join(" ");
  return [streetLine, details.barangay, details.cityMunicipality ?? details.city, details.province, details.region, details.postalCode]
    .map(clean)
    .filter(Boolean)
    .join(", ");
}

/** Task locations only need the pin's building, street, barangay, and city. */
export function formatTaskAddressDetails(details: AddressDetails) {
  const streetLine = [details.houseNumber, details.street].map(clean).filter(Boolean).join(" ");
  return [streetLine, details.barangay, details.cityMunicipality ?? details.city]
    .map(clean)
    .filter(Boolean)
    .join(", ");
}

export function hasAddressDetails(details: AddressDetails) {
  return Boolean(formatAddressDetails(details));
}

export function normalizeAddressDetails(details: AddressDetails): AddressDetails {
  return Object.fromEntries(
    Object.entries(details)
      .map(([key, value]) => [key, clean(value)])
      .filter(([, value]) => Boolean(value))
  ) as AddressDetails;
}

function clean(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}
