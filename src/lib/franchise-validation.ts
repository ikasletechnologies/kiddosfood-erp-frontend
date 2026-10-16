// Super Admin Add / Edit Franchise form rules. Mirrors the backend's
// src/modules/franchise/franchise.validation.ts — keep the two in sync.
// Not used by Headquarters Setup (/setup).

export const EMAIL_REGEX =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export type FranchiseFieldErrors = Partial<Record<"aadhaarNumber" | "panNumber" | "email" | "password" | "contactNum", string>>;

export function validateEmail(raw: string): string | undefined {
  const email = raw.trim();
  if (!email) return "Email ID is required";
  if (email.length > 254 || !EMAIL_REGEX.test(email)) return "Enter a valid email address (e.g. admin@example.com)";
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "Password is required";
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters`;
}

// Optional fields: only validated when a value is entered.
export function validateAadhaar(raw: string): string | undefined {
  const v = raw.replace(/\s/g, "");
  if (v && !/^\d{12}$/.test(v)) return "Aadhaar number must be exactly 12 digits";
}

export function validatePan(raw: string): string | undefined {
  const v = raw.trim().toUpperCase();
  if (v && !PAN_REGEX.test(v)) return "Enter a valid PAN (format: AAAAA9999A)";
}
