import { createInterface } from 'node:readline';

const ENTER_KEYS = new Set(['\r', '\n']);
const CTRL_C = '\u0003';
const BACKSPACE_KEYS = new Set(['\u007f', '\b']);

// Never an argument or an environment variable: either would show up in shell history or `ps`.
export async function readPasswordFromStdin(): Promise<string> {
  if (!process.stdin.isTTY) {
    return readFirstLine(process.stdin);
  }
  const password = await promptWithoutEcho('Password: ');
  const confirmation = await promptWithoutEcho('Repeat the password: ');
  if (password !== confirmation) {
    throw new Error('The two passwords do not match');
  }
  return password;
}

export function readFirstLine(input: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve) => {
    const lines = createInterface({ input });
    let firstLine = '';
    lines.once('line', (line) => {
      firstLine = line;
      lines.close();
    });
    lines.once('close', () => resolve(firstLine));
  });
}

function promptWithoutEcho(prompt: string): Promise<string> {
  process.stderr.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  let typed = '';
  return new Promise((resolve, reject) => {
    const onKey = (key: string): void => {
      if (ENTER_KEYS.has(key)) {
        finish();
        resolve(typed);
      } else if (key === CTRL_C) {
        finish();
        reject(new Error('Cancelled'));
      } else if (BACKSPACE_KEYS.has(key)) {
        typed = typed.slice(0, -1);
      } else {
        typed += key;
      }
    };
    const finish = (): void => {
      process.stdin.off('data', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write('\n');
    };
    process.stdin.on('data', onKey);
  });
}
