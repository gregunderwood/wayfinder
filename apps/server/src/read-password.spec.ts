import { Readable } from 'node:stream';
import { readFirstLine } from './read-password';

describe('readFirstLine', () => {
  it('returns the piped password without its line ending', async () => {
    const piped = Readable.from(['correct horse battery staple\n']);

    expect(await readFirstLine(piped)).toBe('correct horse battery staple');
  });

  it('ignores everything after the first line', async () => {
    const piped = Readable.from(['first line\nsecond line\n']);

    expect(await readFirstLine(piped)).toBe('first line');
  });

  it('returns an empty string when nothing is piped', async () => {
    expect(await readFirstLine(Readable.from([]))).toBe('');
  });
});
