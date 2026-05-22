# AGENTS.md

## Project overview

This project is a SOVL army list builder.

The app lets users build army lists for the game SOVL by selecting a faction, browsing available units, adding units to a list, selecting upgrades/options where supported, and seeing total point cost update live.

The frontend is a static React app built with Vite and TypeScript, hosted on GitHub Pages.

The game data should come from:

https://github.com/Perwahl/SOVLDataCatalogue

Do not manually hardcode faction/unit data in React components. Instead, create scripts that parse the catalogue files and generate normalized JSON for the frontend.

## Tech stack

- React
- TypeScript
- Vite
- GitHub Pages
- Node.js scripts for data generation
- Static frontend only, no backend for MVP
- localStorage for saved lists

## Main goals

Build an MVP with:

1. Faction selection
2. Unit browser
3. Add/remove units from army list
4. Display unit stats
5. Display point costs
6. Live total points
7. Basic support for model count and upgrades/options, where data allows
8. Save/load army lists with localStorage
9. Export/copy army list as plain text
10. GitHub Pages deployment

## Data source and parser

The data catalogue contains BattleScribe-style files, including faction `.cat` files and a shared `SOVL.gst` file.

Expected catalogue files include faction files such as:

- `AbyssalDemons.cat`
- `AbyssalLegions.cat`
- `DarkbornElves.cat`
- `DeadNations.cat`
- `DeepwoodGuardians.cat`
- `DwarfHolds.cat`
- `ElvenConclaves.cat`
- `EmpiresOfMen.cat`
- `GoatmenRaiders.cat`
- `GreenskinTribes.cat`
- `KnightsOfAvalon.cat`
- `RatkinClans.cat`
- `ReptilianKingdoms.cat`

Parser scripts should:

- Fetch or clone the SOVLDataCatalogue repo.
- Parse `.cat` files and `SOVL.gst`.
- Extract factions, units, stats, point costs, categories, rules, upgrades, and options where possible.
- Generate clean normalized JSON into `src/data/generated`.
- Avoid relying on fragile string matching if XML structure provides better identifiers.
- Log warnings when fields are missing or cannot be parsed.
- Keep parser code separate from UI code.

Suggested scripts:

```bash
npm run generate:data
npm run dev
npm run build
npm run preview
npm run deploy
```

## Current project map

- `scripts/generateData.ts` is the entry point for generated frontend data.
- `scripts/fetchDataCatalogue.ts` fetches/caches the SOVL catalogue repo. Do not make normal builds refetch the catalogue unless explicitly requested.
- `scripts/parseCatalogue.ts` parses `.cat` and `SOVL.gst` files into the normalized app data model.
- `scripts/scrapeRulesAssets.ts` gathers unit icon/image metadata from the SOVL Rules faction source pages.
- `src/types/catalogue.ts` defines the normalized generated data types used by both parser output and UI.
- `src/data/generated` contains generated JSON. Do not hand edit these files; update parser/scripts and rerun `npm run generate:data`.
- `src/features/listBuilder/ListBuilder.tsx` contains the main list-builder screen and UI event handlers.
- `src/features/listBuilder/listBuilderUtils.ts` contains list math, limit enforcement, retinue behavior, export formatting, and helper functions.
- `src/features/listBuilder/useLocalArmyList.ts` owns browser `localStorage` save/load state.
- `src/features/listBuilder/listBuilderTypes.ts` defines saved/current army list item types.

## Where Rules Live

- Force size presets are defined in `ARMY_SIZE_PRESETS` in `scripts/parseCatalogue.ts`.
- Force category limits are parsed from catalogue force entries in `parseForces`.
- Border Patrol uses Warband/category catalogue limits with overrides in `applyForceCategoryOverrides`.
- Border Patrol model minimum/default size overrides live in `getBorderPatrolModelOverrides`.
- Unit selection limits come from top-level unit max constraints in `extractTopLevelMaxSelections`, falling back to scraped rules-site max count when available.
- Spell/cantrip classification lives in `SPELL_NAMES`, `CANTRIP_NAMES`, `HALF_CASTER_NAMES`, and `splitSpellOptionGroup` in `scripts/parseCatalogue.ts`.
- Runtime point totals, model count clamping, unit limit warnings, category usage, and add-blocking logic live in `src/features/listBuilder/listBuilderUtils.ts`.
- Fast category half-count logic for bats/dogs/wolves/chariots is in `getCategoryLimitWeight`, `isFastLimitCategory`, and `isHalfFastLimitUnit`.
- Commander retinue/mount behavior is handled by `getRetinueSelection`, `getSelectedRetinueUnit`, `getRetinueCount`, and `makeRetinueListItem`.
- Retinues/mounts should not count toward overall unit count or force category maximums. They should count toward category minimums, such as Border Patrol needing at least 2 Battle Line units, and should still count toward unit-specific max limits such as a one-dragon cap.

## Export Notes

- Plain-text copy export is `exportArmyList` in `src/features/listBuilder/listBuilderUtils.ts`.
- SOVL game JSON file export is `exportSovlListFile` in `src/features/listBuilder/listBuilderUtils.ts`.
- The SOVL JSON export is based on local SOVL save files. Empires of Men `factionType: 1` and Border Patrol `armySize: 4` were verified from samples; other faction/army-size enum values are currently inferred.
- The `SOVL list folder` button in `ListBuilder.tsx` should only copy `%USERPROFILE%\AppData\LocalLow\DalenStudios\SOVL\lists` to the clipboard. It should not try to open the folder from the browser.

## Git Workflow

- Create branches instead of pushing directly to `main`.
- Use the `codex/` branch prefix for Codex work unless the user requests another branch name.
- Open a PR for completed changes.
