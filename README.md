# Local Convert

Local Convert is a private image, video, and audio converter that runs entirely in the browser. Common image conversions use Canvas, while specialist image formats, video, and audio use FFmpeg WebAssembly. Browsers with cross-origin isolation use the faster multithreaded core; restricted browsers automatically fall back to a single-thread core. Selected media is not uploaded to a conversion server. A production service worker caches the application and both FFmpeg cores so conversions remain available offline after the first successful load.

## Local development

Use Node.js 22 or newer.

```sh
npm install
npm run dev
```

## Production verification

```sh
npm run build
npm run lint
npm run verify:deploy
```

The deployment verifier checks required routes and SEO files, parses the structured data, validates the compressed WASM file and its Cloudflare headers, and rejects any output asset larger than Cloudflare Pages' 25 MiB limit.

## Cloudflare Pages

Configure the Pages project with:

- Framework preset: React (Vite)
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root
- Node.js version: 22

No Pages Functions, server, database, or runtime environment variables are required. The `public/_headers` file enables cross-origin isolation for multithreaded FFmpeg and tells Cloudflare that the generated WASM asset is already gzip-compressed.

Point the production custom domain at `convert.sethworks.xyz`. Preview deployments on `pages.dev` receive Cloudflare's automatic `X-Robots-Tag: noindex` header, while the canonical URLs, sitemap, and structured data consistently reference the production domain.
