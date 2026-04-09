# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Build nav data then start dev server (localhost:3000)
pnpm build        # Generate nav + build to dist/
pnpm generate-nav # Regenerate src/router/nav-data.json and src/router/pages.json only
```

`prebuild` automatically runs `generate-nav` before every build. The dev script also pre-builds to ensure nav data is fresh.

## Architecture

This is a Vue 3 + Vite static site that serves as a **navigation hub** for PayPal/GMS payment SDK test pages.

### How the nav system works

1. **Source pages** live in `src/pages/` as standalone `.html` files organized into folders.
2. **`scripts/generate-nav.js`** runs at build time and:
   - Calls `scanner.js` → recursively walks `src/pages/` and returns a directory tree
   - Calls `formatter.js` → converts the tree into a 4-level nav JSON structure
   - Writes `src/router/nav-data.json` (consumed by `App.vue`) and `src/router/pages.json`
3. **`vite.config.js`** has two custom plugins:
   - `copyPages`: copies `.html` files from `src/pages/` to `dist/` at build time (skipping `noshow-` prefixed items)
   - `serve-src-pages`: dev server middleware that serves `src/pages/*.html` files directly
4. **`App.vue`** imports `nav-data.json` and renders `<NavColumn>` components for each top-level nav panel.

### Folder/file naming conventions in `src/pages/`

| Pattern | Behavior |
|---------|----------|
| `[N]-name/` | Sets sort order; displayed name strips the `[N]-` prefix |
| `noshow-name/` | Excluded from both nav and dist copy |
| `hidden-name/` | Copied to dist but hidden from nav |
| `config.json` in a folder | Sets `name`, `icon`, `expanded` for that folder's nav entry |
| `link-xxx.json` in a folder | Rendered as an external link in the nav (contains `href` and `name`) |
| `index.html` in a folder | The folder becomes a single nav item; sibling `.html` files are ignored in nav |

### Nav data structure (`nav-data.json`)

4-level hierarchy: **panel → groups → subGroups → items**. Each item has `url`, `text`, `isExternal`, `isFolder`, and optionally `children`/`subGroups`.

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages at `https://ppgms-test.github.io/`.
