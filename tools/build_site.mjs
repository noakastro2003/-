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
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;padding:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>
${body}
</body></html>
`);
console.log("site/ built");
