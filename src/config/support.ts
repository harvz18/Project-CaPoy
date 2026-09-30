const configuredSupportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";

export const supportEmail = configuredSupportEmail;
export const hasSupportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredSupportEmail);

export function supportContactLabel() {
  return hasSupportEmail ? supportEmail : "Not configured for this beta build";
}
