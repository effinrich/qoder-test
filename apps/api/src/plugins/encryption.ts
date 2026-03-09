import crypto from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

interface EncryptionService {
  encrypt(plaintext: string): Buffer;
  decrypt(ciphertext: Buffer): string;
}

declare module 'fastify' {
  interface FastifyInstance {
    encryption: EncryptionService;
  }
}

export default fp(async function encryptionPlugin(fastify: FastifyInstance) {
  const keyHex = fastify.config.encryption.key;
  
  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  
  const key = Buffer.from(keyHex, 'hex');

  const encryption: EncryptionService = {
    encrypt(plaintext: string): Buffer {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);
      
      const authTag = cipher.getAuthTag();
      
      // Format: IV (16) + AuthTag (16) + Ciphertext
      return Buffer.concat([iv, authTag, encrypted]);
    },

    decrypt(ciphertext: Buffer): string {
      if (ciphertext.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new Error('Invalid ciphertext: too short');
      }

      const iv = ciphertext.subarray(0, IV_LENGTH);
      const authTag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = ciphertext.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    },
  };

  fastify.decorate('encryption', encryption);
}, {
  name: 'encryption',
  dependencies: ['config'],
});
