# CalR Vue Prototype Migration

This repository is the in-progress Vue 3 migration of a single-file CalR prototype.

The original prototype is preserved at [index.prototype.html](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/index.prototype.html). The active app is now a Vite + Vue 3 project using the Options API.

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
```

## Current Structure

- [index.html](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/index.html): Vite entry
- [src/main.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/main.js): app bootstrap
- [src/App.vue](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/App.vue): shell with header and tab nav
- [src/router/index.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/router/index.js): route-backed tabs
- [src/views](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/views): page-level views
- [src/services/registryService.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/services/registryService.js): API calls for registry/auth/analysis
- [src/utils/csv.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/csv.js): CSV parsing and data/session shaping
- [src/utils/plotting.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting.js): Plotly render helpers
- [src/store/appStore.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/store/appStore.js): shared reactive app state
- [src/styles/app.css](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/styles/app.css): app-level styles

## Routes

- `/`: home/dashboard
- `/account`: account and experiment management
- `/analysis`: public datasets and experiment analysis
- `/community`: community summary/comparison view

## Data Sources

- Public/user experiment data and sessions are loaded from the backend registry APIs.
- Community summary data is still loaded from the local CSV in [public/calrepo_summary_v1.csv](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/public/calrepo_summary_v1.csv).

## Analysis Page Status

The analysis page is now broadly at parity with the prototype for the main plotting workflow.

Implemented:

- public dataset listing and selection
- experiment metadata display
- group color controls shared across plots
- time-series plot
- distribution plot
- regression plot
- QC plot and controls
- power plot and controls
- weight plot
- ANCOVA request/output section
- route-backed selected dataset flow
- automatic QC/power/ANCOVA execution after dataset load
- stale/dirty state for backend-driven analyses

## Known Gaps

- The account page is still only partially migrated. Login and file listing/opening are in place, but the upload/convert/session-authoring workflow is not fully ported.
- Power table rendering is based on the current known backend response shape and may need minor refinements as more payload variants appear.
- Plotly bundle size is large and has not yet been optimized.

## Notes

- BootstrapVue Next components are working, but global CSS should remain narrowly scoped so Bootstrap styles are not flattened.
- If you need to compare behavior against the prototype, use [index.prototype.html](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/index.prototype.html) as the reference.
