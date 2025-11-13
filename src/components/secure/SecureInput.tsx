/**
 * SecureInput Component
 * Wrapper around Input component with automatic XSS prevention
 *
 * Features:
 * - Automatic sanitization on blur
 * - XSS prevention
 * - Seamless integration with existing forms
 * - Drop-in replacement for Input component
 *
 * Usage:
 * <SecureInput value={value} onChange={onChange} />
 *
 * The component automatically sanitizes input on blur to prevent XSS
 * while still allowing normal typing experience
 */

import React, { useState, useCallback } from 'react';
import { Input, InputProps } from '@/components/ui/input';
import { Textarea, TextareaProps } from '@/components/ui/textarea';
import { sanitizeText } from '@/utils/inputValidation';

interface SecureInputProps extends InputProps {
  onSecureChange?: (sanitizedValue: string) => void;
  sanitizeOnBlur?: boolean; // Default: true
}

/**
 * Secure Input component with XSS prevention
 */
export const SecureInput = React.forwardRef<HTMLInputElement, SecureInputProps>(
  ({ onSecureChange, onChange, onBlur, sanitizeOnBlur = true, ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(props.value || props.defaultValue || '');

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInternalValue(value);

      // Call original onChange
      onChange?.(e);
    }, [onChange]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      if (sanitizeOnBlur) {
        const sanitized = sanitizeText(e.target.value);

        // Update with sanitized value
        if (sanitized !== e.target.value) {
          e.target.value = sanitized;
          setInternalValue(sanitized);

          // Notify parent with sanitized value
          onSecureChange?.(sanitized);

          // Create synthetic event for onChange
          const syntheticEvent = {
            ...e,
            target: { ...e.target, value: sanitized },
            currentTarget: { ...e.currentTarget, value: sanitized },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange?.(syntheticEvent);
        }
      }

      // Call original onBlur
      onBlur?.(e);
    }, [sanitizeOnBlur, onSecureChange, onChange, onBlur]);

    return (
      <Input
        {...props}
        ref={ref}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    );
  }
);

SecureInput.displayName = 'SecureInput';

interface SecureTextareaProps extends TextareaProps {
  onSecureChange?: (sanitizedValue: string) => void;
  sanitizeOnBlur?: boolean; // Default: true
  maxLength?: number;
}

/**
 * Secure Textarea component with XSS prevention
 */
export const SecureTextarea = React.forwardRef<HTMLTextAreaElement, SecureTextareaProps>(
  ({ onSecureChange, onChange, onBlur, sanitizeOnBlur = true, maxLength, ...props }, ref) => {
    const [charCount, setCharCount] = useState(
      String(props.value || props.defaultValue || '').length
    );

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setCharCount(value.length);

      // Enforce max length
      if (maxLength && value.length > maxLength) {
        return;
      }

      // Call original onChange
      onChange?.(e);
    }, [onChange, maxLength]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
      if (sanitizeOnBlur) {
        const sanitized = sanitizeText(e.target.value);

        // Update with sanitized value
        if (sanitized !== e.target.value) {
          e.target.value = sanitized;
          setCharCount(sanitized.length);

          // Notify parent with sanitized value
          onSecureChange?.(sanitized);

          // Create synthetic event for onChange
          const syntheticEvent = {
            ...e,
            target: { ...e.target, value: sanitized },
            currentTarget: { ...e.currentTarget, value: sanitized },
          } as React.ChangeEvent<HTMLTextAreaElement>;
          onChange?.(syntheticEvent);
        }
      }

      // Call original onBlur
      onBlur?.(e);
    }, [sanitizeOnBlur, onSecureChange, onChange, onBlur]);

    return (
      <div className="relative">
        <Textarea
          {...props}
          ref={ref}
          onChange={handleChange}
          onBlur={handleBlur}
          maxLength={maxLength}
        />
        {maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {charCount} / {maxLength}
          </div>
        )}
      </div>
    );
  }
);

SecureTextarea.displayName = 'SecureTextarea';

export default SecureInput;
