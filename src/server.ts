#!/usr/bin/env -S npx tsx
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClient, describeApiError } from "./analyze.ts";
import { loadConfigOrEmpty, saveConfig } from "./config.ts";
import { describeCredential, getCredential, saveCredentials } from "./credentials.ts";
import { readLastRun, runAnalyze, runDesign, runScan, type AnalyzeResult } from "./pipeline.ts";
import type { MediatorConfig } from "./types.ts";

/**
 * Local web UI. Binds to 127.0.0.1 only, rejects other Host headers (DNS
 * rebinding) and requires JSON bodies on writes (no cross-site form posts).
 */

const { values } = parseArgs({
  options: {
    config: { type: "string", short: "c", default: "mediator.config.json" },
    port: { type: "string", short: "p", default: process.env.PORT ?? "4777" },
    "no-open": { type: "boolean", default: false },
  },
});

const configPath = path.resolve(values.config!);
const UI_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "ui", "index.html");

interface Job {
  id: string;
  feature: string;
  status: "running" | "done" | "error";
  log: string[];
  startedAt: string;
  error?: string;
  result?: Omit<AnalyzeResult, "prompt">;
}
const jobs = new Map<string, Job>();

type Handler = (req: http.IncomingMessage, url: URL, body: any) => Promise<unknown>;
const routes: { method: string; pattern: RegExp; handler: Handler }[] = [];
const route = (method: string, pattern: RegExp, handler: Handler) => routes.push({ method, pattern, handler });

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const config = () => loadConfigOrEmpty(configPath);
const featureParam = (url: URL, re: RegExp) => decodeURIComponent(re.exec(url.pathname)![1]);

// --- config -----------------------------------------------------------------

route("GET", /^\/api\/config$/, async () => {
  const { baseDir, ...plain } = config();
  return { path: configPath, exists: fs.existsSync(configPath), baseDir, config: plain };
});

route("PUT", /^\/api\/config$/, async (_req, _url, body: MediatorConfig) => {
  try {
    saveConfig(configPath, body);
  } catch (err) {
    throw new HttpError(400, (err as Error).message);
  }
  return { ok: true };
});

// --- credentials ------------------------------------------------------------

route("GET", /^\/api\/credentials$/, async () => ({
  anthropicApiKey: describeCredential("anthropicApiKey"),
  figmaToken: describeCredential("figmaToken"),
}));

route("PUT", /^\/api\/credentials$/, async (_req, _url, body) => {
  saveCredentials({ anthropicApiKey: body.anthropicApiKey, figmaToken: body.figmaToken });
  return { ok: true };
});

route("POST", /^\/api\/credentials\/test$/, async (_req, _url, body) => {
  if (body.name === "anthropicApiKey") {
    const model = config().model ?? "claude-opus-5-5";
    try {
      const info = await createClient().models.retrieve(model);
      return { ok: true, message: `Connected. ${info.display_name} is available.` };
    } catch (err) {
      return { ok: false, message: describeApiError(err, model) };
    }
  }
  if (body.name === "figmaToken") {
    const token = getCredential("figmaToken");
    if (!token) return { ok: false, message: "No Figma token saved" };
    const res = await fetch("https://api.figma.com/v1/me", { headers: { "X-Figma-Token": token } });
    if (!res.ok) return { ok: false, message: `Figma said ${res.status}: ${await res.text()}` };
    const me = (await res.json()) as { email?: string; handle?: string };
    return { ok: true, message: `Connected as ${me.handle ?? me.email ?? "your Figma account"}.` };
  }
  throw new HttpError(400, "Unknown credential");
});

// --- folder browser ---------------------------------------------------------

route("GET", /^\/api\/fs$/, async (_req, url) => {
  const requested = url.searchParams.get("path") || os.homedir();
  const dir = path.resolve(requested);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    throw new HttpError(400, `Can't open ${dir}: ${(err as NodeJS.ErrnoException).code}`);
  }
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const folders = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
    .map((e) => {
      const full = path.join(dir, e.name);
      return { name: e.name, path: full, isRepo: fs.existsSync(path.join(full, ".git")) };
    })
    .sort(byName);
  // ?files=json also lists .json files, for picking a local design export.
  const ext = url.searchParams.get("files");
  const files = ext
    ? entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(`.${ext}`))
        .map((e) => ({ name: e.name, path: path.join(dir, e.name) }))
        .sort(byName)
    : [];
  const parent = path.dirname(dir);
  return {
    path: dir,
    parent: parent === dir ? null : parent,
    home: os.homedir(),
    isRepo: fs.existsSync(path.join(dir, ".git")),
    folders,
    files,
  };
});

// --- pipeline ---------------------------------------------------------------

const FEATURE = /^\/api\/features\/([^/]+)\/(design|scan|analyze|last-run)$/;

route("POST", FEATURE, async (_req, url, body) => {
  const name = featureParam(url, FEATURE);
  const stage = FEATURE.exec(url.pathname)![2];
  const cfg = config();
  try {
    if (stage === "design") return await runDesign(cfg, name);
    if (stage === "scan") {
      const r = await runScan(cfg, name);
      return {
        keywords: r.keywords,
        totalCandidates: r.totalCandidates,
        screens: r.design.screens.length,
        snippets: r.selected.map(({ text, ...s }) => ({ ...s, chars: text.length, preview: text.split("\n").slice(0, 12).join("\n") })),
      };
    }
  } catch (err) {
    throw new HttpError(400, (err as Error).message);
  }
  if (stage === "analyze") {
    const job: Job = { id: randomUUID(), feature: name, status: "running", log: [], startedAt: new Date().toISOString() };
    jobs.set(job.id, job);
    runAnalyze(cfg, name, { dryRun: Boolean(body?.dryRun), onProgress: (m) => job.log.push(m) })
      .then(({ prompt: _p, ...result }) => { job.result = result; job.status = "done"; })
      .catch((err) => { job.error = (err as Error).message; job.status = "error"; });
    return { jobId: job.id };
  }
  throw new HttpError(404, "Not found");
});

route("GET", FEATURE, async (_req, url) => {
  if (FEATURE.exec(url.pathname)![2] !== "last-run") throw new HttpError(405, "Use POST");
  return readLastRun(config(), featureParam(url, FEATURE));
});

route("GET", /^\/api\/jobs\/([^/]+)$/, async (_req, url) => {
  const job = jobs.get(/^\/api\/jobs\/([^/]+)$/.exec(url.pathname)![1]);
  if (!job) throw new HttpError(404, "No such job (the server may have restarted)");
  return job;
});

// --- server -----------------------------------------------------------------

function send(res: http.ServerResponse, status: number, body: unknown, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(type === "application/json" ? JSON.stringify(body) : (body as string));
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 5_000_000) throw new HttpError(413, "Body too large");
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new HttpError(400, "Invalid JSON"); }
}

function start(port: number, attemptsLeft = 10) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const server = http.createServer(async (req, res) => {
    try {
      if (!allowedHosts.has(req.headers.host ?? "")) throw new HttpError(403, "Forbidden host");
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        return send(res, 200, fs.readFileSync(UI_FILE, "utf8"), "text/html; charset=utf-8");
      }

      const match = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
      if (!match) {
        const pathExists = routes.some((r) => r.pattern.test(url.pathname));
        throw new HttpError(pathExists ? 405 : 404, pathExists ? "Method not allowed" : "Not found");
      }
      let body: unknown = {};
      if (req.method !== "GET") {
        if (!(req.headers["content-type"] ?? "").startsWith("application/json")) {
          throw new HttpError(415, "Send JSON");
        }
        body = await readJson(req);
      }
      send(res, 200, (await match.handler(req, url, body)) ?? null);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      send(res, status, { error: (err as Error).message });
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && attemptsLeft > 0) return start(port + 1, attemptsLeft - 1);
    console.error(err.message);
    process.exit(1);
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}`;
    console.log(`design-mediator UI running at ${url}`);
    console.log(`Config file: ${configPath}${fs.existsSync(configPath) ? "" : " (created when you first save)"}`);
    console.log("Press Ctrl+C to stop.");
    if (!values["no-open"]) openBrowser(url);
  });
}

function openBrowser(url: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}

start(Number(values.port));
