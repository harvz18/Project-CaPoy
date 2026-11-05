export const workerCapabilities = [
  "Cleaning",
  "Laundry",
  "Errands",
  "Heavy lifting",
  "Delivery assistance",
  "Basic repair",
  "Gardening",
  "Tutoring",
  "Pet care",
  "Event assistance",
  "Other"
];

// Task categories intentionally reuse established capability language where it
// already exists. Broader categories map to an existing skill rather than
// introducing duplicate capability names.
export const taskCategories = [
  "Cleaning",
  "Delivery assistance",
  "Moving assistance",
  "Home maintenance",
  "Gardening",
  "Errands",
  "Tutoring",
  "Event assistance",
  "Other"
] as const;

const categoryDefaults: Record<(typeof taskCategories)[number], string> = {
  "Cleaning": "Cleaning",
  "Delivery assistance": "Delivery assistance",
  "Moving assistance": "Heavy lifting",
  "Home maintenance": "Basic repair",
  "Gardening": "Gardening",
  "Errands": "Errands",
  "Tutoring": "Tutoring",
  "Event assistance": "Event assistance",
  "Other": "Other"
};

export function getDefaultCapabilityForCategory(category: string) {
  return categoryDefaults[category as keyof typeof categoryDefaults] ?? "Other";
}

