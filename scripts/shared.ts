import { createInterface } from "node:readline/promises";
import { config } from "dotenv";

// Same env loading as drizzle.config.ts. DATABASE_URL set in the shell wins,
// which is how you point these scripts at production.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// Imported lazily so the env files above are loaded before lib/db/client.ts
// reads DATABASE_URL.
export async function loadDb() {
  const { db } = await import("../lib/db/client");
  const schema = await import("../lib/db/schema");
  return { db, ...schema };
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Piped stdin (e.g. `printf 'pw\npw\n' | npm run user:create …`) is read one
// line per prompt from a single shared iterator.
let pipedLines: AsyncIterator<string> | undefined;

async function readPipedLine(): Promise<string> {
  pipedLines ??= createInterface({ input: process.stdin })[
    Symbol.asyncIterator
  ]();
  const { value, done } = await pipedLines.next();
  if (done) fail("\nUnexpected end of input.");
  return value;
}

export async function prompt(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    process.stdout.write(question);
    return readPipedLine();
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

// Like prompt(), but doesn't echo what's typed.
export async function promptHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    process.stdout.write(question + "\n");
    return readPipedLine();
  }
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve) => {
    let value = "";
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          // Ctrl-C
          finish();
          fail("Cancelled.");
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      }
    };
    stdin.on("data", onData);
  });
}

export async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} [y/N] `);
  return /^y(es)?$/i.test(answer.trim());
}
