// Turns the single-file preview build (dist-preview/index.html) into the page
// format used for the private claude.ai preview link: no <html>/<head>/<body>
// wrapper, just the title, fonts, styles, app container and script.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-preview/index.html', 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>Confession Enquiries</title>';
const fonts = pick(/<link[^>]+fonts\.googleapis\.com\/css2[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script type="module"[^>]*>[\s\S]*?<\/script>/g);
const out = [title, ...fonts, ...styles, '<div id="root"></div>', ...scripts].join('\n');
writeFileSync('dist-preview/confession-preview.html', out);
console.log(`dist-preview/confession-preview.html (${Math.round(out.length / 1024)} KB)`);
