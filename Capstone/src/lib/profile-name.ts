export type ProfileNameSource = {
  firstName?: unknown
  fullName?: unknown
  lastName?: unknown
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''

/**
 * Uses structured names when both values are available. Legacy profiles retain
 * their established display name instead of attempting to infer name parts.
 */
export const resolveProfileDisplayName = ({ firstName, fullName, lastName }: ProfileNameSource) => {
  const structuredFirstName = text(firstName)
  const structuredLastName = text(lastName)
  const legacyFullName = text(fullName)

  if (structuredFirstName && structuredLastName) {
    return `${structuredFirstName} ${structuredLastName}`
  }

  return legacyFullName || structuredFirstName || structuredLastName
}

export const composeProfileFullName = (firstName: string, lastName: string) =>
  `${firstName.trim()} ${lastName.trim()}`.trim()
