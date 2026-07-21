/**
 * Export every portfolio slide at the desktop web viewport ratio (1920x913).
 * Usage: npm run export:pdf
 */
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "export");
const OUT_PDF = path.join(OUT_DIR, "portfolio-deck-1920x913.pdf");
const WIDTH = 1920;
const HEIGHT = 913;
const SCALE = 2;

const PAGES = [
  "index.html",
  "pages/profile.html",
  "pages/works.html",
  "pages/papers.html",
  "pages/detect.html",
  "pages/detect-why.html",
  "pages/fuzz.html",
  "pages/fuzz-why.html",
  "pages/mini1.html",
  "pages/mini1-why.html",
  "pages/mini2.html",
  "pages/mini2-why.html",
  "pages/mini3.html",
  "pages/mini3-why.html",
  "pages/final1.html",
  "pages/final1-why.html",
  "pages/final2.html",
  "pages/final2-why.html",
  "pages/connect.html",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".gif": "image/gif",
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const filePath = path.resolve(ROOT, "." + rel.replace(/\\/g, "/"));
      const rootLower = ROOT.toLowerCase();
      if (!filePath.toLowerCase().startsWith(rootLower) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function capturePage(browser, base, file) {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
  });
  await page.emulateMedia({ media: "screen", reducedMotion: "reduce" });
  await page.goto(`${base}/${file}`, { waitUntil: "load", timeout: 90000 });
  await page.evaluate(async () => {
    document.documentElement.classList.add("is-exporting");
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    document.documentElement.dataset.exportReady = "true";
  });
  await page.waitForFunction(() => document.documentElement.dataset.exportReady === "true");
  const png = await page.screenshot({ type: "png", fullPage: false, animations: "disabled" });
  await page.close();
  if (png.length < 30000) throw new Error(`Blank-looking capture for ${file} (${png.length} bytes)`);
  return png;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    console.warn("Playwright Chromium is unavailable; falling back to Microsoft Edge.");
    try {
      return await chromium.launch({ headless: true, channel: "msedge" });
    } catch {
      throw error;
    }
  }
}

async function main() {
  if (PAGES.length !== 19) throw new Error("Expected 19 pages");
  await mkdir(OUT_DIR, { recursive: true });
  const { server, base } = await startStaticServer();
  console.log("Serving", ROOT, "at", base);
  const browser = await launchBrowser();
  const pdf = await PDFDocument.create();
  try {
    for (let i = 0; i < PAGES.length; i++) {
      const file = PAGES[i];
      process.stdout.write(`[${String(i + 1).padStart(2, "0")}/19] ${file} ... `);
      const png = await capturePage(browser, base, file);
      const image = await pdf.embedPng(png);
      const p = pdf.addPage([WIDTH, HEIGHT]);
      p.drawImage(image, { x: 0, y: 0, width: WIDTH, height: HEIGHT });
      console.log("ok", Math.round(png.length / 1024) + "KB");
    }
  } finally {
    await browser.close();
    server.close();
  }
  const bytes = await pdf.save();
  await writeFile(OUT_PDF, bytes);
  console.log("\nWrote", OUT_PDF);
  console.log("Pages:", pdf.getPageCount(), "size:", (bytes.length / 1024 / 1024).toFixed(1) + "MB");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
