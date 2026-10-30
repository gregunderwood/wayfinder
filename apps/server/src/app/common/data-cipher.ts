import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import type { EnvLookup } from '../../database';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const KEY_ID_LENGTH = 8;
const FORMAT_VERSION = 'v1';
const KEY_PATTERN = /^[0-9a-f]{64}$/i;

export interface EncryptedValue {
  keyId: string;
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}

// Each value names the key that sealed it, so a rotated key fails loudly instead of decrypting garbage.
export class DataCipher {
  private readonly keyId: string;

  constructor(private readonly key: Buffer) {
    if (key.length !== KEY_BYTES) {
      throw new Error(`The data encryption key must be ${KEY_BYTES} bytes`);
    }
    this.keyId = identifyKey(key);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return serialise({
      keyId: this.keyId,
      iv,
      authTag: cipher.getAuthTag(),
      ciphertext,
    });
  }

  decrypt(storedValue: string): string {
    const { keyId, iv, authTag, ciphertext } = parse(storedValue);
    if (keyId !== this.keyId) {
      throw new Error(
        `Value was encrypted with key ${keyId}, but the current key is ${this.keyId}`,
      );
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }
}

export function readDataEncryptionKey(env: EnvLookup): Buffer {
  const hexKey = env('DATA_ENCRYPTION_KEY');
  if (!hexKey || !KEY_PATTERN.test(hexKey)) {
    throw new Error(
      'DATA_ENCRYPTION_KEY must be 64 hex characters; see .env.example',
    );
  }
  return Buffer.from(hexKey, 'hex');
}

function identifyKey(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, KEY_ID_LENGTH);
}

function serialise({ keyId, iv, authTag, ciphertext }: EncryptedValue): string {
  return [
    FORMAT_VERSION,
    keyId,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

function parse(storedValue: string): EncryptedValue {
  const [version, keyId, iv, authTag, ciphertext] = storedValue.split(':');
  if (version !== FORMAT_VERSION || !keyId || !iv || !authTag || !ciphertext) {
    throw new Error('Not a value produced by DataCipher');
  }
  return {
    keyId,
    iv: Buffer.from(iv, 'base64'),
    authTag: Buffer.from(authTag, 'base64'),
    ciphertext: Buffer.from(ciphertext, 'base64'),
  };
}
