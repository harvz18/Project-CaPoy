import { isValidScheduleDate } from "./taskMarketplace";
import { isValidMoneyAmount } from "../utils/numericInput";
import { hasValidCoordinates } from "../utils/location";

export type TaskPostingInput = {
  title: string;
  description: string;
  category: string;
  location: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadius?: number;
  locationSource?: "device" | "manual" | "map";
  requiredCapabilities?: string[];
  wage: string;
  durationValue: number;
  scheduleMode: "fixed" | "anytime";
  scheduleDate?: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  pricingMode: "fixed" | "bidding";
  paymentMethod?: string;
};

export type TaskPostingField = "category" | "title" | "description" | "landmark" | "address" | "pin" | "capabilities" | "budget" | "duration" | "schedule" | "payment";

/** Shared UI/server-side client validation for a new TaskLink task. */
export function getTaskPostingErrors(input: TaskPostingInput): Partial<Record<TaskPostingField, string>> {
  const errors: Partial<Record<TaskPostingField, string>> = {};
  if (!input.category.trim()) errors.category = "Please select a task category.";
  if (!input.title.trim()) errors.title = "Task title is required.";
  if (!input.description.trim()) errors.description = "Task description is required.";
  if (!input.location.trim()) errors.landmark = "Please enter a recognizable landmark.";
  if (!input.locationAddress?.trim()) errors.address = "Please enter or select the task address.";
  else if (!isBacolodAddress(input.locationAddress)) errors.address = "Choose an address within Bacolod City.";
  if (!hasValidCoordinates({ latitude: input.latitude, longitude: input.longitude }) || !input.locationSource) {
    errors.pin = "Set a valid task pin using device location or the map.";
  } else if (!isBacolodServiceArea(input.latitude as number, input.longitude as number)) {
    errors.pin = "Choose a task pin within Bacolod City.";
  }
  if (!input.geofenceRadius || input.geofenceRadius < 100 || input.geofenceRadius > 5000) {
    errors.pin = "Choose a task service radius from 100 to 5,000 meters.";
  }
  if (!input.requiredCapabilities?.length) errors.capabilities = "Select at least one required capability.";
  if (input.pricingMode === "fixed") {
    if (!input.wage.trim()) errors.budget = "Budget is required.";
    else if (!isValidMoneyAmount(input.wage) || Number(input.wage) < 150) errors.budget = "Minimum budget is ₱150.";
  }
  if (!Number.isInteger(input.durationValue) || input.durationValue < 1 || input.durationValue > 365) {
    errors.duration = "Enter a duration from 1 to 365.";
  }
  if (input.scheduleMode === "anytime") {
    if (!isValidScheduleDate(input.scheduleDate)) errors.schedule = "Choose a valid task date.";
  } else {
    const start = Date.parse(input.scheduleStart ?? "");
    const end = Date.parse(input.scheduleEnd ?? "");
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) errors.schedule = "Choose a valid task schedule.";
  }
  if (!input.paymentMethod) errors.payment = "Please select a payment method.";
  return errors;
}

export function isBacolodAddress(address: string) {
  return /\bbacolod(?:\s+city)?\b/i.test(address);
}

/** A deliberately generous Bacolod envelope; reverse geocoding supplies the final city check. */
export function isBacolodServiceArea(latitude: number, longitude: number) {
  return latitude >= 10.54 && latitude <= 10.86 && longitude >= 122.78 && longitude <= 123.10;
}
