// Production static file server for the built frontend (dist/). `vite preview` (Vite's own
// previous "start" command here) is documented as a local-preview convenience, not a production
// server - it doesn't gzip/brotli responses and sends `Cache-Control: no-cache` on every file,
// including the content-hashed JS/CSS Vite already builds specifically so they *can* be cached
// forever. This server does both properly: hashed assets under /assets get a far-future immutable
// cache (a new deploy always produces new filenames, so there's no staleness risk), and every
// response is compressed.
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

const app = express();

app.use(compression());

// Vite content-hashes everything under assets/ (e.g. index-DWYaNCJk.js) - safe to cache for a
// year since any change produces a different filename.
app.use('/assets', express.static(path.join(distDir, 'assets'), {
  immutable: true,
  maxAge: '1y',
}));

// Everything else in dist/ (favicon, robots.txt, sitemap.xml, manifest, etc.) isn't hashed, so it
// gets a short cache instead - `index: false` so this doesn't itself serve index.html (that's
// handled explicitly below, where its own no-cache header is set).
app.use(express.static(distDir, { index: false, maxAge: '1h' }));

// SPA fallback - any request that didn't match a real file (a client-side route like
// /product/:id) serves index.html and lets react-router-dom take over. Never cached, so a fresh
// deploy (which references new hashed asset filenames) is always picked up immediately rather
// than serving a stale index.html that points at assets which no longer exist.
app.use((_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Frontend server listening on port ${port}`);
});
