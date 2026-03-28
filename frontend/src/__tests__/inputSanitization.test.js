/**
 * Input Sanitization Tests
 * Test suite for input sanitization utilities
 */

import {
  escapeHtml,
  sanitizeHtml,
  sanitizeText,
  validateAndSanitizeDID,
  validateAndSanitizePublicKey,
  validateAndSanitizeSecretKey,
  validateAndSanitizeUrl,
  sanitizeJsonForDisplay,
  sanitizeSuggestions
} from '../utils/inputSanitization';

describe('Input Sanitization Utilities', () => {
  describe('escapeHtml', () => {
    test('should escape HTML special characters', () => {
      const input = '<script>alert("xss")</script>';
      const result = escapeHtml(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should handle empty input', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    test('should handle non-string input', () => {
      expect(escapeHtml(123)).toBe('');
      expect(escapeHtml({})).toBe('');
    });
  });

  describe('sanitizeHtml', () => {
    test('should remove dangerous tags', () => {
      const input = '<script>alert("xss")</script><p>Safe content</p>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Safe content</p>');
    });

    test('should remove dangerous attributes', () => {
      const input = '<div onclick="alert(\'xss\')" class="safe">Content</div>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onclick');
      expect(result).toContain('class="safe"');
    });

    test('should handle empty input', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null)).toBe('');
    });
  });

  describe('sanitizeText', () => {
    test('should remove HTML brackets and dangerous protocols', () => {
      const input = '<script>alert("xss")</script>javascript:alert()';
      const result = sanitizeText(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('javascript:');
    });

    test('should trim whitespace', () => {
      const input = '  test  ';
      expect(sanitizeText(input)).toBe('test');
    });

    test('should handle empty input', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null)).toBe('');
    });
  });

  describe('validateAndSanitizeDID', () => {
    test('should validate correct DID format', () => {
      const did = 'did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
      const result = validateAndSanitizeDID(did);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedDid).toBe(did);
    });

    test('should reject invalid DID format', () => {
      const did = 'invalid:did';
      const result = validateAndSanitizeDID(did);
      expect(result.isValid).toBe(false);
      expect(result.sanitizedDid).toBe('invalid:did');
    });

    test('should handle XSS attempts in DID', () => {
      const did = 'did:stellar:G<script>alert("xss")</script>';
      const result = validateAndSanitizeDID(did);
      expect(result.isValid).toBe(false);
      expect(result.sanitizedDid).not.toContain('<script>');
    });
  });

  describe('validateAndSanitizePublicKey', () => {
    test('should validate correct public key format', () => {
      const key = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
      const result = validateAndSanitizePublicKey(key);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedKey).toBe(key);
    });

    test('should reject invalid public key format', () => {
      const key = 'invalid-key';
      const result = validateAndSanitizePublicKey(key);
      expect(result.isValid).toBe(false);
    });

    test('should handle XSS attempts in public key', () => {
      const key = 'G<script>alert("xss")</script>';
      const result = validateAndSanitizePublicKey(key);
      expect(result.isValid).toBe(false);
      expect(result.sanitizedKey).not.toContain('<script>');
    });
  });

  describe('validateAndSanitizeSecretKey', () => {
    test('should validate correct secret key format', () => {
      const key = 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
      const result = validateAndSanitizeSecretKey(key);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedKey).toBe(key);
    });

    test('should reject invalid secret key format', () => {
      const key = 'invalid-key';
      const result = validateAndSanitizeSecretKey(key);
      expect(result.isValid).toBe(false);
    });

    test('should handle XSS attempts in secret key', () => {
      const key = 'S<script>alert("xss")</script>';
      const result = validateAndSanitizeSecretKey(key);
      expect(result.isValid).toBe(false);
      expect(result.sanitizedKey).not.toContain('<script>');
    });
  });

  describe('validateAndSanitizeUrl', () => {
    test('should validate correct HTTP URL', () => {
      const url = 'https://example.com';
      const result = validateAndSanitizeUrl(url);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedUrl).toBe(url);
    });

    test('should reject dangerous protocols', () => {
      const url = 'javascript:alert("xss")';
      const result = validateAndSanitizeUrl(url);
      expect(result.isValid).toBe(false);
      expect(result.sanitizedUrl).toBe('');
    });

    test('should handle malformed URLs', () => {
      const url = 'not-a-url';
      const result = validateAndSanitizeUrl(url);
      expect(result.isValid).toBe(false);
      expect(result.sanitizedUrl).toBe('');
    });
  });

  describe('sanitizeJsonForDisplay', () => {
    test('should safely serialize JSON for display', () => {
      const data = { key: '<script>alert("xss")</script>' };
      const result = sanitizeJsonForDisplay(data);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    test('should handle invalid JSON', () => {
      const data = { circular: {} };
      data.circular.self = data.circular;
      const result = sanitizeJsonForDisplay(data);
      expect(result).toBe('Invalid data format');
    });
  });

  describe('sanitizeSuggestions', () => {
    test('should sanitize array of suggestions', () => {
      const suggestions = ['<script>alert("xss")</script>', 'safe suggestion'];
      const result = sanitizeSuggestions(suggestions);
      expect(result).toHaveLength(2);
      expect(result[0]).not.toContain('<script>');
      expect(result[1]).toBe('safe suggestion');
    });

    test('should handle empty array', () => {
      expect(sanitizeSuggestions([])).toEqual([]);
      expect(sanitizeSuggestions(null)).toEqual([]);
    });

    test('should filter non-string suggestions', () => {
      const suggestions = ['valid', 123, null, undefined, { invalid: 'object' }];
      const result = sanitizeSuggestions(suggestions);
      expect(result).toEqual(['valid']);
    });
  });
});

describe('XSS Prevention Tests', () => {
  test('should prevent script injection in text fields', () => {
    const xssPayload = '<script>alert("xss")</script>';
    expect(sanitizeText(xssPayload)).not.toContain('<script>');
  });

  test('should prevent event handler injection', () => {
    const xssPayload = '<div onclick="alert(\'xss\')">Click me</div>';
    expect(sanitizeHtml(xssPayload)).not.toContain('onclick');
  });

  test('should prevent javascript protocol injection', () => {
    const xssPayload = 'javascript:alert("xss")';
    expect(sanitizeText(xssPayload)).not.toContain('javascript:');
  });

  test('should prevent data protocol injection', () => {
    const xssPayload = 'data:text/html,<script>alert("xss")</script>';
    expect(sanitizeText(xssPayload)).not.toContain('data:');
  });

  test('should prevent vbscript protocol injection', () => {
    const xssPayload = 'vbscript:msgbox("xss")';
    expect(sanitizeText(xssPayload)).not.toContain('vbscript:');
  });
});

describe('Input Validation Integration Tests', () => {
  test('should handle complex XSS attempts', () => {
    const complexXss = '<img src=x onerror=alert("xss")><script>alert("xss")</script>javascript:alert("xss")';
    
    expect(escapeHtml(complexXss)).not.toContain('<script>');
    expect(sanitizeHtml(complexXss)).not.toContain('onerror');
    expect(sanitizeText(complexXss)).not.toContain('<script>');
    expect(sanitizeText(complexXss)).not.toContain('javascript:');
  });

  test('should preserve safe content while removing dangerous parts', () => {
    const mixedContent = 'Safe text <script>alert("xss")</script> more safe text';
    const sanitized = sanitizeText(mixedContent);
    
    expect(sanitized).toContain('Safe text');
    expect(sanitized).toContain('more safe text');
    expect(sanitized).not.toContain('<script>');
  });
});
