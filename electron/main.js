"use strict";
/**
 * electron/main.js — JNguyen Co. CRM desktop entry point
 *
 * Key design decisions:
 *  - Runs Next.js on port 3000 (matches NEXT_PUBLIC_APP_URL=http://localhost:3000)
 *    so Supabase OAuth callbacks land on the right server with no config changes.
 *  - Strips "Electron" from the user-agent so Google's OAuth doesn't block the flow.
 *  - Google OAuth happens INSIDE the Electron window so session cookies are set
 *    in Electron's own cookie jar (not Chrome's).
 *  - Truly external links (Drive, Instagram, etc.) still open in the system browser.
 */

const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const PORT = 3000;
const APP_ORIGIN = `http://localhost:${PORT}`;

let mainWindow = null;
let serverProcess = null;

// ── 1. Load env vars ──────────────────────────────────────────────────────────
// Packaged: reads {resourcesPath}/.env  (copied from .env.local by build script)
// Dev:      reads {projectRoot}/.env.local
function loadEnv() {
  const envFile = app.isPackaged
    ? path.join(process.resourcesPath, ".env")
    : path.join(__dirname, "..", ".env.local");

  if (!fs.existsSync(envFile)) {
    console.warn("[env] No env file found at:", envFile);
    return;
  }

  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx < 1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
  console.log("[env] Loaded env from:", envFile);
}

// ── 2. Start the Next.js standalone server ────────────────────────────────────
function startServer() {
  const serverScript = app.isPackaged
    ? path.join(process.resourcesPath, "server", "server.js")
    : path.join(__dirname, "..", ".next", "standalone", "server.js");

  if (!fs.existsSync(serverScript)) {
    console.error("[server] server.js not found:", serverScript, "\nRun `npm run build` first.");
    return;
  }

  console.log("[server] Starting Next.js at:", serverScript);

  serverProcess = spawn("node", [serverScript], {
    cwd: path.dirname(serverScript),
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "0.0.0.0", // listen on all interfaces so localhost resolves
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => console.log("[next]", d.toString().trimEnd()));
  serverProcess.stderr.on("data", (d) => console.error("[next]", d.toString().trimEnd()));
  serverProcess.on("error", (e) => console.error("[server] spawn error:", e.message));
  serverProcess.on("exit", (code) => console.log("[server] exited with code", code));
}

// ── 3. Poll until the server responds ────────────────────────────────────────
function waitForServer(callback, attempts = 0) {
  const req = http.get(`http://localhost:${PORT}`, (res) => {
    res.destroy();
    callback();
  });
  let done = false;
  const next = () => {
    if (done) return;
    done = true;
    if (attempts < 80) {
      setTimeout(() => waitForServer(callback, attempts + 1), 500);
    } else {
      console.error("[electron] Server did not start within 40s — loading anyway");
      callback();
    }
  };
  req.on("error", next);
  req.on("close", next); // Node 18+: destroy() emits close, not always error
  req.setTimeout(1000, () => req.destroy());
}

// ── 4. Decide if a URL is part of the OAuth / auth flow ──────────────────────
// These URLs must stay in the Electron window so session cookies land here.
function isAuthUrl(url) {
  return (
    url.startsWith(APP_ORIGIN) ||
    url.startsWith("http://127.0.0.1:" + PORT) ||
    url.includes("accounts.google.com") ||
    url.includes("supabase.co/auth") ||
    url.includes("supabase.co/rest")
  );
}

// ── 5. Create the BrowserWindow ───────────────────────────────────────────────
function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "server", "public", "PNG", "IconicNavy.png")
    : path.join(__dirname, "..", "public", "PNG", "IconicNavy.png");

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "JNguyen Co. CRM",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: "#f7f4f1",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.setMenuBarVisibility(false);

  // Strip "Electron/x.x.x" from the user-agent so Google OAuth doesn't block us.
  // Google detects embedded browser user-agents and may refuse OAuth flows.
  mainWindow.webContents.on("did-finish-load", () => {
    const ua = mainWindow.webContents.getUserAgent();
    const cleanUa = ua.replace(/\s*Electron\/[\d.]+\s*/g, " ").trim();
    mainWindow.webContents.setUserAgent(cleanUa);
  });

  // Loading screen while server starts
  mainWindow.loadURL(
    "data:text/html," +
      encodeURIComponent(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { background: #f7f4f1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; gap: 14px; }
  h1 { color: #083a4f; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
  p  { color: #a58d66; font-size: 13px; }
  .dot { display: inline-block; width: 6px; height: 6px; background: #407e8c; border-radius: 50%;
         margin: 0 3px; animation: bounce 1.2s infinite; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce { 0%,80%,100% { transform: scale(0.6); opacity:.4; } 40% { transform: scale(1); opacity:1; } }
</style></head>
<body>
  <h1>JNguyen Co. CRM</h1>
  <p>Starting up<span class="dot"></span><span class="dot"></span><span class="dot"></span></p>
</body></html>`)
  );
  mainWindow.show();

  // Navigate to the app once the server is ready
  waitForServer(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(APP_ORIGIN);
    }
  });

  // Navigation handler:
  // - Auth/OAuth URLs → stay in Electron window (cookies set here)
  // - Vercel OAuth callback → rewrite to localhost so local server handles it
  //   (happens when localhost isn't whitelisted in Supabase redirect URLs)
  // - Everything else (Drive, Instagram, external sites) → open in system browser
  mainWindow.webContents.on("will-navigate", (event, url) => {
    // If Supabase sent the OAuth callback to the Vercel deployment instead of
    // localhost (because localhost isn't in the Supabase allowed-redirect list),
    // intercept and rewrite the origin so the local server handles the session.
    const VERCEL_ORIGIN = "https://jnguyenco-crm.vercel.app";
    if (url.startsWith(VERCEL_ORIGIN + "/api/auth/callback") ||
        url.startsWith(VERCEL_ORIGIN + "/auth/callback")) {
      event.preventDefault();
      const localUrl = url.replace(VERCEL_ORIGIN, APP_ORIGIN);
      mainWindow.loadURL(localUrl);
      return;
    }
    if (!isAuthUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // New window requests: always open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAuthUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  loadEnv();
  startServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
});
