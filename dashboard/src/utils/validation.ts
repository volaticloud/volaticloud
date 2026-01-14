/**
 * Shared validation utilities for the dashboard application.
 */

/**
 * Email validation regex pattern.
 * Matches standard email format: local-part@domain.tld
 *
 * @example
 * isValidEmail('user@example.com') // true
 * isValidEmail('user.name+tag@example.co.uk') // true
 * isValidEmail('invalid') // false
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an email address format.
 *
 * @param email - The email address to validate
 * @returns true if the email format is valid, false otherwise
 *
 * @example
 * isValidEmail('user@example.com') // true
 * isValidEmail('invalid-email') // false
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_REGEX.test(email);
}

/**
 * Validates a URL format.
 *
 * @param url - The URL to validate
 * @returns true if the URL format is valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates that a string is not empty after trimming whitespace.
 *
 * @param value - The string to validate
 * @returns true if the string is not empty, false otherwise
 */
export function isNotEmpty(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
