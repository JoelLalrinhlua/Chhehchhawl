/**
 * validation.ts — Input-validation helpers for auth & profile flows.
 *
 * Exports:
 *  • `isValidEmail`          — Loose RFC-5322-style email check.
 *  • `checkPasswordStrength` — Returns { score, feedback } (0–4 scale).
 *  • `isValidIndianPhone`    — 10-digit Indian mobile number check.
 *  • `isValidDateOfBirth`    — Age 13–120 range check.
 *  • `normalizePhone`        — Strips whitespace/dashes, ensures +91 prefix.
 */

/** Loose RFC-5322-ish email check */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Password strength rules:
 *  - >= 8 characters
 *  - at least 1 uppercase letter
 *  - at least 1 lowercase letter
 *  - at least 1 digit
 *  - at least 1 special character
 */
export interface PasswordCheck {
  valid: boolean;
  message: string;
}

export function checkPasswordStrength(password: string): PasswordCheck {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password needs at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password needs at least one lowercase letter' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password needs at least one digit' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: 'Password needs at least one special character' };
  }
  return { valid: true, message: '' };
}

/** Validate a 10-digit Indian phone number (with optional +91 prefix) */
export function isValidIndianPhone(phone: string): boolean {
  const stripped = phone.replace(/[\s\-()]/g, '');
  // Accept +91XXXXXXXXXX or 0XXXXXXXXXX or just 10 digits starting with 6-9
  return /^(\+91|0)?[6-9]\d{9}$/.test(stripped);
}

/** Validate that a date of birth makes the user at least `minAge` years old */
export function isValidDateOfBirth(dob: Date | string, minAge = 13): boolean {
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  const dayDiff = now.getDate() - d.getDate();
  const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
  return actualAge >= minAge && actualAge <= 120;
}

/** Strip phone to bare digits + optional leading +91 */
export function normalizePhone(phone: string): string {
  let s = phone.replace(/[\s\-()]/g, '');
  if (s.startsWith('0')) s = s.slice(1);
  if (!s.startsWith('+91')) s = '+91' + s;
  return s;
}
