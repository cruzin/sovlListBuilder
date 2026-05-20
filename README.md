# SOVL List Builder

Static React app for building SOVL army lists. The frontend data is generated from the BattleScribe-style catalogue at https://github.com/Perwahl/SOVLDataCatalogue.

## Scripts

- `npm run generate:data` fetches or updates the SOVL data catalogue, scrapes SOVL Rules unit images, and writes normalized JSON to `src/data/generated`.
- `npm run dev` starts the Vite dev server.
- `npm run build` regenerates data and builds the static site.
- `npm run preview` previews the built site locally.

## Data Generation

The generator keeps catalogue parsing out of the React UI:

- `scripts/fetchDataCatalogue.ts` clones or updates `Perwahl/SOVLDataCatalogue`.
- `scripts/parseCatalogue.ts` parses `.cat` faction catalogues and `SOVL.gst`.
- `scripts/scrapeRulesSite.ts` scrapes faction source pages for unit icons, larger images, and rules-page unit types.
- `scripts/generateData.ts` writes `catalogue.json` and one JSON file per faction.

Generated files are committed so the static app can load them without a backend.

## GitHub Pages

Vite is configured with `base: '/sovlListBuilder/'` for GitHub Pages. The workflow in `.github/workflows/deploy.yml` runs `npm ci`, `npm run build`, and deploys `dist` to the `gh-pages` branch.
