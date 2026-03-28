/**
 * Input Validation Hook
 * Provides client-side input validation with sanitization
 */

import { useState, useCallback } from 'react';
import { 
  validateAndSanitizeDID, 
  validateAndSanitizePublicKey, 
  validateAndSanitizeSecretKey, 
  validateAndSanitizeUrl,
  sanitizeText 
} from '../utils/inputSanitization';

/**
 * Custom hook for input validation and sanitization
 * @param {Object} validationRules - Rules for different fields
 * @returns {Object} - Validation functions and state
 */
export const useInputValidation = (validationRules = {}) => {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  /**
   * Validate a single field
   * @param {string} fieldName - Name of the field
   * @param {string} value - Value to validate
   * @returns {Object} - Validation result
   */
  const validateField = useCallback((fieldName, value) => {
    const rule = validationRules[fieldName];
    if (!rule) {
      return { isValid: true, sanitizedValue: sanitizeText(value), error: null };
    }

    let result = { isValid: true, sanitizedValue: value, error: null };

    switch (rule.type) {
      case 'did':
        result = validateAndSanitizeDID(value);
        break;
      
      case 'publicKey':
        result = validateAndSanitizePublicKey(value);
        break;
      
      case 'secretKey':
        result = validateAndSanitizeSecretKey(value);
        break;
      
      case 'url':
        result = validateAndSanitizeUrl(value);
        break;
      
      case 'text':
        const sanitized = sanitizeText(value);
        result = {
          isValid: true,
          sanitizedValue: sanitized,
          error: null
        };
        
        // Length validation
        if (rule.minLength && sanitized.length < rule.minLength) {
          result.isValid = false;
          result.error = `Minimum length is ${rule.minLength} characters`;
        }
        
        if (rule.maxLength && sanitized.length > rule.maxLength) {
          result.isValid = false;
          result.error = `Maximum length is ${rule.maxLength} characters`;
        }
        
        // Required validation
        if (rule.required && !sanitized.trim()) {
          result.isValid = false;
          result.error = 'This field is required';
        }
        
        // Pattern validation
        if (rule.pattern && !new RegExp(rule.pattern).test(sanitized)) {
          result.isValid = false;
          result.error = rule.patternMessage || 'Invalid format';
        }
        break;
      
      default:
        result = {
          isValid: true,
          sanitizedValue: sanitizeText(value),
          error: null
        };
    }

    return result;
  }, [validationRules]);

  /**
   * Handle field change with validation
   * @param {string} fieldName - Name of the field
   * @param {string} value - New value
   * @returns {string} - Sanitized value
   */
  const handleChange = useCallback((fieldName, value) => {
    const result = validateField(fieldName, value);
    
    setErrors(prev => ({
      ...prev,
      [fieldName]: result.error
    }));
    
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));
    
    return result.sanitizedValue;
  }, [validateField]);

  /**
   * Validate all fields
   * @param {Object} values - All field values
   * @returns {Object} - Validation results for all fields
   */
  const validateAll = useCallback((values) => {
    const newErrors = {};
    const sanitizedValues = {};
    let isValid = true;

    Object.keys(validationRules).forEach(fieldName => {
      const result = validateField(fieldName, values[fieldName] || '');
      
      sanitizedValues[fieldName] = result.sanitizedValue;
      
      if (!result.isValid) {
        newErrors[fieldName] = result.error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    setTouched(Object.keys(validationRules).reduce((acc, field) => ({ ...acc, [field]: true }), {}));

    return { isValid, sanitizedValues, errors: newErrors };
  }, [validationRules, validateField]);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  /**
   * Clear specific field error
   * @param {string} fieldName - Field name to clear
   */
  const clearFieldError = useCallback((fieldName) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  /**
   * Check if form has any errors
   * @returns {boolean} - True if there are errors
   */
  const hasErrors = useCallback(() => {
    return Object.keys(errors).some(key => errors[key] !== null && errors[key] !== undefined);
  }, [errors]);

  return {
    errors,
    touched,
    handleChange,
    validateField,
    validateAll,
    clearErrors,
    clearFieldError,
    hasErrors
  };
};

/**
 * Predefined validation rules for common DID operations
 */
export const DID_VALIDATION_RULES = {
  did: {
    type: 'did',
    required: true
  },
  publicKey: {
    type: 'publicKey',
    required: true
  },
  secretKey: {
    type: 'secretKey',
    required: true
  },
  serviceEndpoint: {
    type: 'url',
    required: false
  }
};

export const CREDENTIAL_VALIDATION_RULES = {
  issuerDID: {
    type: 'did',
    required: true
  },
  subjectDID: {
    type: 'did',
    required: true
  },
  credentialType: {
    type: 'text',
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: '^[a-zA-Z0-9\\-_\\.]+$',
    patternMessage: 'Credential type can only contain letters, numbers, hyphens, underscores, and dots'
  },
  signerSecret: {
    type: 'secretKey',
    required: true
  }
};

export const RESOLVE_DID_VALIDATION_RULES = {
  did: {
    type: 'did',
    required: true
  }
};

export default useInputValidation;
