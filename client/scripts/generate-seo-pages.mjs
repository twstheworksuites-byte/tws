import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DEFAULT_IMAGE, SITE_NAME, SITE_URL, indexablePages, structuredData } from '../src/seoConfig.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const template = await readFile(path.join(dist, 'index.html'), 'utf8');
const seoDir = path.join(dist, 'seo');
await mkdir(seoDir, { recursive: true });

const escapeAttribute = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');
const escapeText = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceMeta(html, attribute, key, content) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${escapeRegExp(key)}"[^>]*>`, 'i');
  const tag = `<meta ${attribute}="${escapeAttribute(key)}" content="${escapeAttribute(content)}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function replaceLink(html, rel, extraAttribute, extraValue, href) {
  const extra = extraAttribute ? `\\s+${extraAttribute}="${escapeRegExp(extraValue)}"` : '';
  const pattern = new RegExp(`<link\\s+rel="${escapeRegExp(rel)}"${extra}[^>]*>`, 'i');
  const tag = `<link rel="${escapeAttribute(rel)}"${extraAttribute ? ` ${extraAttribute}="${escapeAttribute(extraValue)}"` : ''} href="${escapeAttribute(href)}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function render(page, pathname) {
  const canonical = `${SITE_URL}${pathname === '/' ? '/' : pathname}`;
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeText(page.title)}</title>`);
  html = replaceMeta(html, 'name', 'description', page.description);
  html = replaceMeta(html, 'name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  html = replaceMeta(html, 'name', 'googlebot', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  html = replaceMeta(html, 'property', 'og:type', 'website');
  html = replaceMeta(html, 'property', 'og:locale', 'en_IN');
  html = replaceMeta(html, 'property', 'og:site_name', SITE_NAME);
  html = replaceMeta(html, 'property', 'og:title', page.title);
  html = replaceMeta(html, 'property', 'og:description', page.description);
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'property', 'og:image', DEFAULT_IMAGE);
  html = replaceMeta(html, 'property', 'og:image:secure_url', DEFAULT_IMAGE);
  html = replaceMeta(html, 'property', 'og:image:type', 'image/webp');
  html = replaceMeta(html, 'property', 'og:image:width', '1800');
  html = replaceMeta(html, 'property', 'og:image:height', '1013');
  html = replaceMeta(html, 'property', 'og:image:alt', 'The Work Suites office workspace in Bengaluru');
  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = replaceMeta(html, 'name', 'twitter:title', page.title);
  html = replaceMeta(html, 'name', 'twitter:description', page.description);
  html = replaceMeta(html, 'name', 'twitter:image', DEFAULT_IMAGE);
  html = replaceMeta(html, 'name', 'twitter:image:alt', 'The Work Suites office workspace in Bengaluru');
  html = replaceLink(html, 'canonical', '', '', canonical);
  html = replaceLink(html, 'alternate', 'hreflang', 'en-IN', canonical);

  const jsonLd = JSON.stringify(structuredData(page, canonical, pathname)).replaceAll('<', '\\u003c');
  const script = `<script id="tws-structured-data" type="application/ld+json">${jsonLd}</script>`;
  const scriptPattern = /<script\s+id="tws-structured-data"[^>]*>[\s\S]*?<\/script>/i;
  html = scriptPattern.test(html) ? html.replace(scriptPattern, script) : html.replace('</head>', `    ${script}\n  </head>`);
  return html;
}

for (const [pathname, page] of Object.entries(indexablePages)) {
  const html = render(page, pathname);
  const destination = pathname === '/' ? path.join(dist, 'index.html') : path.join(seoDir, `${pathname.slice(1)}.html`);
  await writeFile(destination, html);
}

console.log(`Generated metadata-first HTML for ${Object.keys(indexablePages).length} indexable routes.`);
