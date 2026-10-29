import {
  OTHER_DATA_ENCRYPTION_KEY,
  TEST_DATA_ENCRYPTION_KEY,
} from '../../testing/test-secrets';
import { DataCipher, readDataEncryptionKey } from './data-cipher';

describe('DataCipher', () => {
  const cipher = new DataCipher(TEST_DATA_ENCRYPTION_KEY);

  it('reads back what it encrypted', () => {
    expect(cipher.decrypt(cipher.encrypt('owner@example.com'))).toBe(
      'owner@example.com',
    );
  });

  it('never stores the plaintext, and never produces the same value twice', () => {
    const first = cipher.encrypt('owner@example.com');
    const second = cipher.encrypt('owner@example.com');

    expect(first).not.toContain('owner');
    expect(first).not.toBe(second);
  });

  it('refuses a value that was tampered with', () => {
    const [version, keyId, iv, authTag, ciphertext] = cipher
      .encrypt('owner@example.com')
      .split(':');
    const flippedCiphertext = Buffer.from(ciphertext, 'base64');
    flippedCiphertext[0] ^= 1;
    const tampered = [
      version,
      keyId,
      iv,
      authTag,
      flippedCiphertext.toString('base64'),
    ].join(':');

    expect(() => cipher.decrypt(tampered)).toThrow();
  });

  it('names the key that is missing rather than decrypting with the wrong one', () => {
    const sealedByAnotherKey = new DataCipher(
      OTHER_DATA_ENCRYPTION_KEY,
    ).encrypt('owner@example.com');

    expect(() => cipher.decrypt(sealedByAnotherKey)).toThrow(
      /encrypted with key [0-9a-f]{8}/,
    );
  });

  it('refuses a value it did not produce', () => {
    expect(() => cipher.decrypt('owner@example.com')).toThrow(
      'Not a value produced by DataCipher',
    );
  });

  it('refuses a key of the wrong length', () => {
    expect(() => new DataCipher(Buffer.alloc(16))).toThrow('32 bytes');
  });
});

describe('readDataEncryptionKey', () => {
  it('reads 64 hex characters as a 32-byte key', () => {
    const key = readDataEncryptionKey(() => 'ab'.repeat(32));
    expect(key).toHaveLength(32);
  });

  it.each([undefined, '', 'not-hex', 'ab'.repeat(16)])(
    'refuses %j',
    (configuredKey) => {
      expect(() => readDataEncryptionKey(() => configuredKey)).toThrow(
        'DATA_ENCRYPTION_KEY must be 64 hex characters',
      );
    },
  );
});
