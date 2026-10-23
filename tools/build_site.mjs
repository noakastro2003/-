// Builds site/ for Netlify from app/: same game files, plus a full HTML page that switches the game to the site's own API.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const app = new URL("../app/", import.meta.url), site = new URL("../site/", import.meta.url);
rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });
for (const f of ["app.js", "app.css", "img", "fonts"]) cpSync(new URL(f, app), new URL(f, site), { recursive: true });

const body = readFileSync(new URL("index.html", app), "utf8")
  .replace('<script src="app.js"></script>', '<script>window.GM_HOST = "netlify";</script>\n<script src="app.js"></script>');
writeFileSync(new URL("index.html", site), `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="icon" type="image/png" href="img/favicon-64.png">
<link rel="apple-touch-icon" href="img/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-title" content="גלקסיית המילים">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#1b1464">
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;padding:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>
${body}
</body></html>
`);
// home-screen app: name, icons, and full screen without the browser bar
writeFileSync(new URL("manifest.webmanifest", site), JSON.stringify({
  name: "גלקסיית המילים", short_name: "גלקסיית המילים", lang: "he", dir: "rtl",
  start_url: "/", scope: "/", display: "standalone", orientation: "portrait",
  background_color: "#1b1464", theme_color: "#1b1464",
  icons: [
    { src: "img/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "img/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2));
console.log("site/ built");
