// Builds the installable (PWA) version of RISING into ./app from rising.html.
// rising.html is the single source: it is published as the claude.ai artifact as-is,
// and wrapped here with a manifest, icons and an offline service worker.
//   node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const OUT = new URL("./app/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const write = (name, data) => writeFileSync(new URL(name, OUT), data);

const page = readFileSync(new URL("./rising.html", import.meta.url), "utf8");
const version = Date.now().toString(36);

// ---------- icons: an ember on the night sky, drawn pixel by pixel ----------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const mix = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
function emberPNG(size, { maskable = false } = {}) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2, cy = size * 0.53, R = size * (maskable ? 0.24 : 0.3);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      // sky: night at top, dusk glow at the bottom
      const v = y / size;
      let r = mix(14, 52, v * v), g = mix(11, 26, v * v), b = mix(28, 64, v * v);
      const d = Math.hypot(x - cx, y - cy) / R;
      // halo
      const halo = d < 1 ? 0.6 : Math.exp(-Math.pow((d - 1) / 0.45, 2)) * 0.6;
      r = mix(r, 255, halo); g = mix(g, 123, halo); b = mix(b, 62, halo);
      // core: white-gold center to ember edge
      if (d < 1) {
        const t = d;
        const cr = t < 0.25 ? mix(255, 244, t / 0.25) : t < 0.6 ? mix(244, 255, (t - 0.25) / 0.35) : mix(255, 196, (t - 0.6) / 0.4);
        const cg = t < 0.25 ? mix(243, 196, t / 0.25) : t < 0.6 ? mix(196, 123, (t - 0.25) / 0.35) : mix(123, 60, (t - 0.6) / 0.4);
        const cb = t < 0.25 ? mix(214, 106, t / 0.25) : t < 0.6 ? mix(106, 62, (t - 0.25) / 0.35) : mix(62, 40, (t - 0.6) / 0.4);
        const edge = Math.min(1, (1 - d) * R * 0.5);
        r = mix(r, cr, edge); g = mix(g, cg, edge); b = mix(b, cb, edge);
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
write("icon-192.png", emberPNG(192));
write("icon-512.png", emberPNG(512));
write("icon-maskable-512.png", emberPNG(512, { maskable: true }));
write("apple-touch-icon.png", emberPNG(180));

// ---------- manifest ----------
write("manifest.webmanifest", JSON.stringify({
  name: "RISING",
  short_name: "RISING",
  description: "Hold the ember. Rise again.",
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "portrait",
  background_color: "#0e0b1c",
  theme_color: "#0e0b1c",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2));

// ---------- service worker: app shell offline, fonts cached on first use ----------
write("sw.js", `const CACHE = "rising-${version}";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;
  if (req.mode === "navigate") {
    // network first for the page so updates land, cache when offline
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return r; }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
`);

// ---------- index.html ----------
write("index.html", `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0e0b1c">
<meta name="description" content="Hold the ember. Rise again.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="RISING">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${page}
<script>
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
</script>
</body>
</html>
`);

console.log("Built app/ (version " + version + ")");
