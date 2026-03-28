/**
 * Input Sanitization Utility
 * Provides functions to sanitize user inputs and prevent XSS attacks
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
export const escapeHtml = (str) => {
  if (typeof str !== 'string') {
    return '';
  }
  
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/**
 * Sanitize HTML content by removing dangerous elements and attributes
 * @param {string} html - The HTML string to sanitize
 * @returns {string} - The sanitized HTML string
 */
export const sanitizeHtml = (html) => {
  if (typeof html !== 'string') {
    return '';
  }

  // Create a temporary DOM element to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Remove dangerous tags
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'];
  dangerousTags.forEach(tag => {
    const elements = tempDiv.getElementsByTagName(tag);
    for (let i = elements.length - 1; i >= 0; i--) {
      elements[i].remove();
    }
  });

  // Remove dangerous attributes
  const dangerousAttributes = ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'];
  const allElements = tempDiv.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i];
    dangerousAttributes.forEach(attr => {
      if (element.hasAttribute(attr)) {
        element.removeAttribute(attr);
      }
    });
  }

  return tempDiv.innerHTML;
};

/**
 * Sanitize user input for display in text context
 * @param {string} input - The user input to sanitize
 * @returns {string} - The sanitized input
 */
export const sanitizeText = (input) => {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove basic HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, ''); // Remove vbscript: protocol
};

/**
 * Validate and sanitize DID format
 * @param {string} did - The DID to validate and sanitize
 * @returns {object} - { isValid: boolean, sanitizedDid: string }
 */
export const validateAndSanitizeDID = (did) => {
  if (typeof did !== 'string') {
    return { isValid: false, sanitizedDid: '' };
  }

  const sanitized = sanitizeText(did.trim());
  const didRegex = /^did:stellar:G[A-Z2-7]{55}$/;
  
  return {
    isValid: didRegex.test(sanitized),
    sanitizedDid: sanitized
  };
};

/**
 * Validate and sanitize Stellar public key
 * @param {string} publicKey - The public key to validate and sanitize
 * @returns {object} - { isValid: boolean, sanitizedKey: string }
 */
export const validateAndSanitizePublicKey = (publicKey) => {
  if (typeof publicKey !== 'string') {
    return { isValid: false, sanitizedKey: '' };
  }

  const sanitized = sanitizeText(publicKey.trim());
  const keyRegex = /^G[A-Z2-7]{55}$/;
  
  return {
    isValid: keyRegex.test(sanitized),
    sanitizedKey: sanitized
  };
};

/**
 * Validate and sanitize Stellar secret key
 * @param {string} secretKey - The secret key to validate and sanitize
 * @returns {object} - { isValid: boolean, sanitizedKey: string }
 */
export const validateAndSanitizeSecretKey = (secretKey) => {
  if (typeof secretKey !== 'string') {
    return { isValid: false, sanitizedKey: '' };
  }

  const sanitized = sanitizeText(secretKey.trim());
  const keyRegex = /^S[A-Z2-7]{55}$/;
  
  return {
    isValid: keyRegex.test(sanitized),
    sanitizedKey: sanitized
  };
};

/**
 * Validate and sanitize URL
 * @param {string} url - The URL to validate and sanitize
 * @returns {object} - { isValid: boolean, sanitizedUrl: string }
 */
export const validateAndSanitizeUrl = (url) => {
  if (typeof url !== 'string') {
    return { isValid: false, sanitizedUrl: '' };
  }

  const sanitized = sanitizeText(url.trim());
  
  try {
    const urlObj = new URL(sanitized);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, sanitizedUrl: '' };
    }
    
    return {
      isValid: true,
      sanitizedUrl: urlObj.toString()
    };
  } catch (e) {
    return { isValid: false, sanitizedUrl: '' };
  }
};

/**
 * Sanitize JSON data for display
 * @param {object} data - The data to sanitize
 * @returns {string} - Sanitized JSON string
 */
export const sanitizeJsonForDisplay = (data) => {
  try {
    // Convert to JSON and escape HTML
    const jsonString = JSON.stringify(data, null, 2);
    return escapeHtml(jsonString);
  } catch (e) {
    return escapeHtml('Invalid data format');
  }
};

/**
 * Create safe DOM element with sanitized content
 * @param {string} tagName - The tag name to create
 * @param {object} attributes - The attributes to set (sanitized)
 * @param {string} content - The text content (sanitized)
 * @returns {HTMLElement} - The created DOM element
 */
export const createSafeElement = (tagName, attributes = {}, content = '') => {
  const element = document.createElement(tagName);
  
  // Set attributes safely
  Object.keys(attributes).forEach(key => {
    // Only allow safe attributes
    if (!key.startsWith('on') && key !== 'innerHTML') {
      element.setAttribute(key, sanitizeText(attributes[key]));
    }
  });
  
  // Set text content safely
  if (content) {
    element.textContent = sanitizeText(content);
  }
  
  return element;
};

/**
 * Sanitize suggestions for autocomplete dropdown
 * @param {Array} suggestions - Array of suggestion strings
 * @returns {Array} - Array of sanitized suggestion strings
 */
export const sanitizeSuggestions = (suggestions) => {
  if (!Array.isArray(suggestions)) {
    return [];
  }
  
  return suggestions
    .filter(suggestion => typeof suggestion === 'string')
    .map(suggestion => escapeHtml(sanitizeText(suggestion)))
    .filter(suggestion => suggestion.length > 0);
};

/**
 * Default export with all sanitization functions
 */
export default {
  escapeHtml,
  sanitizeHtml,
  sanitizeText,
  validateAndSanitizeDID,
  validateAndSanitizePublicKey,
  validateAndSanitizeSecretKey,
  validateAndSanitizeUrl,
  sanitizeJsonForDisplay,
  createSafeElement,
  sanitizeSuggestions
};
