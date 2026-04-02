# CalR Vue

Vue 3 + Vite frontend for browsing, configuring, and analyzing CalR datasets.

This app is a rebuild of the older single-file prototype preserved in [index.prototype.html](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/index.prototype.html).

## Stack

- Vue 3
- Vite
- Vue Router
- Bootstrap 5
- BootstrapVue Next
- Plotly
- Papa Parse

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Current Structure

- [src/views](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/views): page-level screens
- [src/router/index.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/router/index.js): app routes
- [src/services/registryService.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/services/registryService.js): backend API calls
- [src/utils/process.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/process.js): shared CALR/session normalization and aggregation helpers
- [src/utils/prep-for-analysis.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/prep-for-analysis.js): shared analysis-ready dataset preparation
- [src/utils/plotting](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting): plot-specific renderers and plotting helpers
- [src/store/appStore.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/store/appStore.js): shared reactive app state
- [src/styles/app.css](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/styles/app.css): app styles

## Routes

- `#/`: dashboard
- `#/account`: account and experiment management
- `#/analysis`: dataset analysis
- `#/community`: community summary comparison

The app uses hash routing for GitHub Pages compatibility.

## Analysis Data Flow

The shared frontend analysis boundary is:

1. load converted CALR detail CSV
2. load session CSV
3. load session JSON config
4. run `prepForAnalysis(...)`
5. pass the resulting `analysisData` into plot-specific renderers

Shared analysis prep lives in:

- [src/utils/prep-for-analysis.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/prep-for-analysis.js)

Plot-specific prep and Plotly rendering live in:

- [src/utils/plotting/time-series.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/time-series.js)
- [src/utils/plotting/box-plot.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/box-plot.js)
- [src/utils/plotting/regression.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/regression.js)
- [src/utils/plotting/weight.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/weight.js)
- [src/utils/plotting/qc.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/qc.js)
- [src/utils/plotting/power.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/power.js)
- [src/utils/plotting/summary-regression.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/summary-regression.js)

## Current Status

### Working

- public and private dataset browsing
- converted dataset loading into analysis
- session CSV + session JSON merge for analysis
- time-series plot
- box plot
- regression plot
- weight plot
- QC plot
- power plot
- ANCOVA / ANOVA summary section
- community summary comparison plot
- account-side create/edit/open flows

### Important Notes

- `JS_REBUILD_FILES_REFERENCE` is the current behavior reference for rebuilt analysis logic.
- Avoid dataset-specific fixes.
- Some backend-driven analysis sections are still marked as in progress in the UI:
  - QC
  - Power
  - ANCOVA

### Memory / Performance

Some memory cleanup has already been done:

- removed deep reactive watching over the full analysis dataset
- batched plot renders
- added Plotly purge on unmount
- reduced unnecessary analysis-row cloning
- added and bounded shared derived-data caches

Memory work is not the current focus, but it is still an area to revisit later.

## Backend Dependencies

This frontend depends on the live CalR backend APIs for:

- auth
- file listing
- converted data/session loading
- QC analysis
- power analysis
- ANCOVA analysis

The app is static-hostable, but runtime behavior still depends on those APIs being reachable and permitting the deployed frontend origin.

## GitHub Pages

This repo includes a GitHub Pages workflow at [.github/workflows/deploy-pages.yml](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/.github/workflows/deploy-pages.yml).

Deployment setup:

1. Push the repo to GitHub.
2. Make sure the deploy branch matches the workflow, currently `main`.
3. In GitHub repo settings, open `Pages`.
4. Set the source to `GitHub Actions`.
5. Push to `main` or run the workflow manually.

The Pages setup uses:

- relative Vite asset paths
- hash routing to avoid SPA path issues

## Reference Files

- [index.prototype.html](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/index.prototype.html)
- [JS_REBUILD_FILES_REFERENCE](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/JS_REBUILD_FILES_REFERENCE)
