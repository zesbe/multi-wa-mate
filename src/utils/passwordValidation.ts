import { z } from "zod";

/**
 * Strong Password Validation Schema
 * Matches backend password policy in supabase/functions/admin-user-management/index.ts
 *
 * Requirements:
 * - Minimum 12 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 * - Not a common weak password
 */

const COMMON_WEAK_PASSWORDS = [
  "password123",
  "password1234",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwerty1234",
  "admin123",
  "admin1234",
  "welcome123",
  "letmein123",
];

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*(),.?":{}|<>]/,
    "Password must contain at least one special character (!@#$%^&*...)"
  )
  .refine(
    (password) => !COMMON_WEAK_PASSWORDS.includes(password.toLowerCase()),
    "Password is too common. Please choose a stronger password"
  );

/**
 * Optional password schema (for updates where password is not required)
 */
export const optionalPasswordSchema = z
  .union([passwordSchema, z.string().length(0)])
  .optional()
  .transform((val) => (val === "" ? undefined : val));

/**
 * Calculate password strength
 * @param password - Password to check
 * @returns {number} Strength score (0-100)
 */
export function calculatePasswordStrength(password: string): number {
  let strength = 0;

  if (!password) return 0;

  // Length score (up to 40 points)
  if (password.length >= 8) strength += 10;
  if (password.length >= 12) strength += 15;
  if (password.length >= 16) strength += 15;

  // Character variety (up to 40 points)
  if (/[a-z]/.test(password)) strength += 10;
  if (/[A-Z]/.test(password)) strength += 10;
  if (/[0-9]/.test(password)) strength += 10;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 10;

  // Patterns (up to 20 points)
  // No repeated characters
  if (!/(.)\1{2,}/.test(password)) strength += 10;
  // No sequential characters
  if (!/abc|bcd|cde|123|234|345/i.test(password)) strength += 10;

  return Math.min(strength, 100);
}

/**
 * Get password strength label
 * @param strength - Strength score (0-100)
 * @returns {object} Label and color
 */
export function getPasswordStrengthLabel(strength: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (strength < 30) {
    return {
      label: "Weak",
      color: "text-red-600",
      bgColor: "bg-red-500",
    };
  }
  if (strength < 60) {
    return {
      label: "Fair",
      color: "text-orange-600",
      bgColor: "bg-orange-500",
    };
  }
  if (strength < 80) {
    return {
      label: "Good",
      color: "text-yellow-600",
      bgColor: "bg-yellow-500",
    };
  }
  return {
    label: "Strong",
    color: "text-green-600",
    bgColor: "bg-green-500",
  };
}

/**
 * Password requirements list for UI display
 */
export const PASSWORD_REQUIREMENTS = [
  "At least 12 characters long",
  "Contains uppercase and lowercase letters",
  "Contains at least one number",
  "Contains at least one special character (!@#$%^&*...)",
  "Not a common password",
];
