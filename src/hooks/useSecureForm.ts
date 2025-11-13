/**
 * useSecureForm Hook
 * Reusable hook for secure form handling with automatic sanitization
 *
 * Features:
 * - Automatic XSS prevention via sanitization
 * - Input validation
 * - Error handling
 * - Integration with existing utilities
 *
 * Usage:
 * const { secureValue, setValue, error } = useSecureForm('');
 */

import { useState, useCallback } from 'react';
import { sanitizeText } from '@/utils/inputValidation';

export interface SecureFormField<T = string> {
  value: T;
  sanitizedValue: string;
  error: string | null;
  setValue: (value: T) => void;
  validate: (validator?: (val: T) => string | null) => boolean;
  reset: () => void;
}

/**
 * Hook for secure text input with automatic sanitization
 * @param initialValue - Initial value
 * @param options - Configuration options
 * @returns Secure form field object
 */
export function useSecureTextInput(
  initialValue: string = '',
  options?: {
    maxLength?: number;
    required?: boolean;
    validator?: (value: string) => string | null;
  }
): SecureFormField<string> {
  const [value, setValueState] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const setValue = useCallback((newValue: string) => {
    setValueState(newValue);
    setError(null); // Clear error on change
  }, []);

  const validate = useCallback((customValidator?: (val: string) => string | null): boolean => {
    // Required validation
    if (options?.required && !value.trim()) {
      setError('This field is required');
      return false;
    }

    // Max length validation
    if (options?.maxLength && value.length > options.maxLength) {
      setError(`Maximum ${options.maxLength} characters allowed`);
      return false;
    }

    // Custom validation
    const validator = customValidator || options?.validator;
    if (validator) {
      const validationError = validator(value);
      if (validationError) {
        setError(validationError);
        return false;
      }
    }

    setError(null);
    return true;
  }, [value, options]);

  const reset = useCallback(() => {
    setValueState(initialValue);
    setError(null);
  }, [initialValue]);

  return {
    value,
    sanitizedValue: sanitizeText(value),
    error,
    setValue,
    validate,
    reset,
  };
}

/**
 * Hook for multiple secure form fields
 * @param initialValues - Object with initial values
 * @returns Object with secure form fields
 */
export function useSecureForm<T extends Record<string, string>>(
  initialValues: T
): {
  values: T;
  sanitizedValues: Record<keyof T, string>;
  errors: Record<keyof T, string | null>;
  setField: (field: keyof T, value: string) => void;
  validateAll: () => boolean;
  reset: () => void;
} {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, string | null>>(
    Object.keys(initialValues).reduce((acc, key) => {
      acc[key as keyof T] = null;
      return acc;
    }, {} as Record<keyof T, string | null>)
  );

  const setField = useCallback((field: keyof T, value: string) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  }, []);

  const validateAll = useCallback((): boolean => {
    let isValid = true;
    const newErrors: Record<keyof T, string | null> = {} as Record<keyof T, string | null>;

    Object.keys(values).forEach((key) => {
      const field = key as keyof T;
      const value = values[field];

      if (!value || value.trim() === '') {
        newErrors[field] = 'This field is required';
        isValid = false;
      } else {
        newErrors[field] = null;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors(
      Object.keys(initialValues).reduce((acc, key) => {
        acc[key as keyof T] = null;
        return acc;
      }, {} as Record<keyof T, string | null>)
    );
  }, [initialValues]);

  // Generate sanitized values
  const sanitizedValues = Object.keys(values).reduce((acc, key) => {
    acc[key as keyof T] = sanitizeText(values[key as keyof T]);
    return acc;
  }, {} as Record<keyof T, string>);

  return {
    values,
    sanitizedValues,
    errors,
    setField,
    validateAll,
    reset,
  };
}

/**
 * Hook for phone number input with validation
 */
export function usePhoneInput(initialValue: string = '') {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const setPhone = useCallback((newValue: string) => {
    // Auto-format: remove non-digits except +
    const cleaned = newValue.replace(/[^\d+]/g, '');
    setValue(cleaned);
    setError(null);
  }, []);

  const validate = useCallback((): boolean => {
    if (!value) {
      setError('Phone number is required');
      return false;
    }

    const cleaned = value.replace(/\D/g, '');

    // Indonesian format validation
    if (!cleaned.startsWith('62')) {
      setError('Phone must start with 62 (Indonesian format)');
      return false;
    }

    if (cleaned.length < 10 || cleaned.length > 15) {
      setError('Invalid phone number length');
      return false;
    }

    setError(null);
    return true;
  }, [value]);

  return {
    value,
    cleanedValue: value.replace(/\D/g, ''),
    error,
    setPhone,
    validate,
  };
}

export default useSecureForm;
