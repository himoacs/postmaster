/**
 * Tests for encryption utilities
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption';

describe('Encryption', () => {
  describe('encrypt', () => {
    it('should encrypt a string successfully', () => {
      const plaintext = 'test-api-key-12345';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:data format
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'test-api-key-12345';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2); // Different IVs
    });

    it('should handle empty strings', () => {
      const encrypted = encrypt('');
      expect(encrypted).toBeTruthy();
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should handle special characters', () => {
      const plaintext = 'sk-!@#$%^&*()_+{}[]|\\:";\'<>?,./';
      const encrypted = encrypt(plaintext);
      expect(encrypted).toBeTruthy();
    });

    it('should handle unicode characters', () => {
      const plaintext = '日本語 🎉 émojis';
      const encrypted = encrypt(plaintext);
      expect(encrypted).toBeTruthy();
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted text correctly', () => {
      const plaintext = 'test-api-key-12345';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'sk-!@#$%^&*()_+{}[]|\\:";\'<>?,./';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '日本語 🎉 émojis';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid format', () => {
      expect(() => decrypt('invalid-format')).toThrow('Invalid encrypted data format');
    });

    it('should throw error for corrupted data', () => {
      const encrypted = encrypt('test');
      const corrupted = encrypted.slice(0, -5) + 'xxxxx';
      
      expect(() => decrypt(corrupted)).toThrow();
    });

    it('should throw error for tampered data', () => {
      const plaintext = 'test-api-key';
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(':');
      
      // Tamper with the encrypted data
      parts[2] = Buffer.from('tampered').toString('base64');
      const tampered = parts.join(':');
      
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    const testCases = [
      { name: 'short key', value: 'abc123' },
      { name: 'OpenAI key', value: 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz' },
      { name: 'Anthropic key', value: 'sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz' },
      { name: 'long text', value: 'a'.repeat(1000) },
      { name: 'multiline', value: 'line1\nline2\nline3' },
    ];

    testCases.forEach(({ name, value }) => {
      it(`should handle ${name}`, () => {
        const encrypted = encrypt(value);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(value);
      });
    });
  });

  describe('maskApiKey', () => {
    it('should mask short keys', () => {
      expect(maskApiKey('abc')).toBe('****');
      expect(maskApiKey('abcdefgh')).toBe('****');
    });

    it('should show first 4 and last 4 characters for long keys', () => {
      const key = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
      const masked = maskApiKey(key);
      
      expect(masked.startsWith('sk-p')).toBe(true);
      expect(masked.endsWith('wxyz')).toBe(true);
      expect(masked).toContain('*');
    });

    it('should handle exact 12 character keys', () => {
      expect(maskApiKey('123456789012')).toBe('****');
    });

    it('should handle 13+ character keys', () => {
      const key = '1234567890123';
      const masked = maskApiKey(key);
      expect(masked.startsWith('1234')).toBe(true);
      expect(masked.endsWith('0123')).toBe(true);
    });

    it('should limit asterisk length', () => {
      const key = 'a'.repeat(100);
      const masked = maskApiKey(key);
      const asteriskCount = (masked.match(/\*/g) || []).length;
      
      expect(asteriskCount).toBeLessThanOrEqual(20);
    });

    it('should handle OpenAI key format', () => {
      const key = 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const masked = maskApiKey(key);
      
      expect(masked).toMatch(/^sk-p.*6789$/);
    });

    it('should handle Anthropic key format', () => {
      const key = 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      const masked = maskApiKey(key);
      
      expect(masked).toMatch(/^sk-a.*wxyz$/);
    });
  });
});
