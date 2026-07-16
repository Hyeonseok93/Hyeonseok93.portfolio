/**
 * Export every portfolio slide as one 1920x1080 page in a single PDF.
 * Deck order follows site-footer numbering (Cover -> ... -> Connect).
 *
 * Usage: npm run export:pdf
 */
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "export");
const OUT_PDF = path.join(OUT_DIR, "portfolio-deck-1920x1080.pdf");

const WIDTH = 1920;
const HEIGHT = 1080;
const SCALE = 2;

const PAGES = [
  "index.html",
  "profile.html",
  "works.html",
  "papers.html",
  "detect.html",
  "detect-why.html",
  "fuzz.html",
  "fuzz-why.html",
  "mini1.html",
  "mini1-why.html",
  "mini2.html",
  "mini2-why.html",
  "mini3.html",
  "mini3-why.html",
  "final1.html",
  "final1-why.html",
  "final2.html",
  "final2-why.html",
  "connect.html",
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
      if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function capturePage(browser, base, file) {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
  });

  await page.goto(`${base}/${file}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(() => document.fonts && document.fonts.status === "loaded").catch(() => {});
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
      html, body {
        width: ${WIDTH}px !important;
        height: ${HEIGHT}px !important;
        max-height: ${HEIGHT}px !important;
        overflow: hidden !important;
      }
      .stage, .frame, .board {
        width: 100% !important;
        height: 100% !important;
      }
      [style*="opacity"], .topbar, .identity, .showcase, .shot,
      .paper-hero, .works, .why__item, .leaf, .work {
        opacity: 1 !important;
        transform: none !important;
      }
    `,
  });
  await page.waitForTimeout(300);

  const png = await page.screenshot({ type: "png", fullPage: false });
  await page.close();
  return png;
}

async function main() {
  if (PAGES.length !== 19) {
    throw new Error(`Expected 19 pages, got ${PAGES.length}`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const { server, base } = await startStaticServer();
  console.log(`Serving ${ROOT} at ${base}`);

  const browser = await chromium.launch({ headless: true });
  const pdf = await PDFDocument.create();

  try {
    for (let i = 0; i < PAGES.length; i++) {
      const file = PAGES[i];
      process.stdout.write(`[${String(i + 1).padStart(2, "0")}/19] ${file} ... `);
      const png = await capturePage(browser, base, file);
      const image = await pdf.embedPng(png);
      const page = pdf.addPage([WIDTH, HEIGHT]);
      page.drawImage(image, { x: 0, y: 0, width: WIDTH, height: HEIGHT });
      console.log("ok");
    }
  } finally {
    await browser.close();
    server.close();
  }

  const bytes = await pdf.save();
  await writeFile(OUT_PDF, bytes);
  console.log(`\nWrote ${OUT_PDF}`);
  console.log(`Pages: ${pdf.getPageCount()} · ${WIDTH}x${HEIGHT} · ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});