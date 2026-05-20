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
