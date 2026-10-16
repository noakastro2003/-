// Builds the in-browser demo into demo/dist: the regular frontend, with the API answered
// by demo-api.js (in the page) instead of server.js. Run: node demo/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'demo', 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public', 'css'), path.join(out, 'css'), { recursive: true });
fs.cpSync(path.join(root, 'public', 'js'), path.join(out, 'js'), { recursive: true });
for (const f of ['validate.js', 'templates.js', 'logic.js', 'ai-prompt.js', 'docx.js', 'billing.js']) {
  fs.copyFileSync(path.join(root, f), path.join(out, f));
}
for (const f of ['demo-api.js', 'store.js', 'api.js']) {
  fs.copyFileSync(path.join(root, 'demo', f), path.join(out, 'js', f));
}
fs.writeFileSync(path.join(out, 'js', 'env.js'), 'export const DEMO = true;\n');

// The page itself: the artifact host adds doctype/head/body, so no wrapper tags here.
fs.writeFileSync(path.join(out, 'index.html'), `<title>מסלולי למידה</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playpen+Sans+Hebrew:wght@400;600&family=Rubik:wght@400;500;700&family=Secular+One&family=Suez+One&family=Varela+Round&display=swap">
<link rel="stylesheet" href="css/style.css">
<script>document.documentElement.lang = 'he'; document.documentElement.dir = 'rtl';</script>
<div id="app" aria-live="polite"></div>
<div id="toasts" role="status" aria-live="polite"></div>
<script type="module" src="js/app.js"></script>
`);

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name !== 'index.html') files.push(path.relative(out, p));
  }
};
walk(out);
console.log(JSON.stringify(files));
