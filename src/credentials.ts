import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Keys live outside the project in ~/.design-mediator/credentials.json (mode 600)
 * so they never end up in git. Environment variables take precedence.
 */
export interface Credentials {
  anthropicApiKey?: string;
  figmaToken?: string;
}

export type CredentialName = keyof Credentials;

const ENV_VARS: Record<CredentialName, string> = {
  anthropicApiKey: "ANTHROPIC_API_KEY",
  figmaToken: "FIGMA_TOKEN",
};

export function homeDir(): string {
  return process.env.DESIGN_MEDIATOR_HOME ?? path.join(os.homedir(), ".design-mediator");
}

function credentialsPath(): string {
  return path.join(homeDir(), "credentials.json");
}

function readStored(): Credentials {
  try {
    return JSON.parse(fs.readFileSync(credentialsPath(), "utf8")) as Credentials;
  } catch {
    return {};
  }
}

export function getCredential(name: CredentialName): string | undefined {
  return process.env[ENV_VARS[name]] || readStored()[name] || undefined;
}

/** Where a credential comes from, with only the last 4 characters shown. */
export function describeCredential(name: CredentialName) {
  const fromEnv = process.env[ENV_VARS[name]];
  const value = fromEnv || readStored()[name];
  return {
    set: Boolean(value),
    source: fromEnv ? ("env" as const) : value ? ("file" as const) : null,
    envVar: ENV_VARS[name],
    hint: value ? `…${value.slice(-4)}` : null,
  };
}

/** Save or clear (empty string) stored credentials. Untouched keys are kept. */
export function saveCredentials(update: Partial<Credentials>): void {
  const next: Credentials = { ...readStored() };
  for (const [key, value] of Object.entries(update) as [CredentialName, string | undefined][]) {
    if (value === undefined) continue;
    if (value.trim()) next[key] = value.trim();
    else delete next[key];
  }
  fs.mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(credentialsPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.chmodSync(credentialsPath(), 0o600);
}
