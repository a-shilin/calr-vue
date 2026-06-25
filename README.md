# CalR Vue

Vue 3 + Vite frontend for browsing, configuring, and analyzing CalR datasets.

This app is a rebuild of the older single-file prototype preserved in [index.prototype.html](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/index.prototype.html).

## Stack

- Vue 3
- Vite
- Vue Router
- Bootstrap 5
- BootstrapVue Next
- Bootstrap Icons
- Plotly
- Papa Parse

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Routes

- `#/`: dashboard
- `#/account`: account and experiment management
- `#/analysis`: dataset analysis
- `#/analysis?share={submission_id}`: shared private dataset analysis
- `#/community`: community summary comparison

The app uses hash routing for GitHub Pages compatibility.

## Current Structure

- [src/views](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/views): page-level screens
- [src/components/MetadataFieldInput.vue](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/components/MetadataFieldInput.vue): shared text/select/select-plus-free-text metadata field input
- [src/config/experimentMetadata.json](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/config/experimentMetadata.json): data-only experiment metadata field definitions
- [src/router/index.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/router/index.js): app routes
- [src/services/registryService.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/services/registryService.js): live CalR backend API calls
- [src/utils/prep-for-analysis.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/prep-for-analysis.js): normalize backend enriched payloads into frontend analysis data
- [src/utils/process.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/process.js): shared session normalization, exclusions, outlier handling, and aggregation helpers
- [src/utils/plotting](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting): plot-specific renderers and plotting helpers
- [src/store/appStore.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/store/appStore.js): shared reactive app state
- [src/styles/app.css](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/styles/app.css): app styles

## Current UX Notes

- The analysis page always shows dataset tabs. Before login, only the public-datasets tab is available.
- The account page shows the experiment list inline under a `Your Experiments` heading.
- The account experiment list includes computed readiness states: `Draft`, `Ready for Analysis`, or `Ready for Public`.
- Account-side dataset rows render as soon as the file list is available, then status badges update progressively as session configs finish loading.
- The account experiment list includes `Public` and `Share` controls. Share is enabled only for datasets that are ready for analysis.
- Dataset tables on the analysis page are constrained in a scrollable container with a max height of 400px.
- Dataset open actions show a spinner plus a percent-loaded indicator while enriched analysis data is downloading.
- Shared private dataset links open through `#/analysis?share={submission_id}`, show a percent-loaded indicator while loading, and render a `Private` pill in the dataset header.
- The account-side create/edit experiment flow opens in an overlay modal with step tabs for upload, session configuration, and metadata.
- Experiment name and description now sit above the builder step tabs and stay visible across the full create/edit flow.
- The upload step shows a paginated CalR data preview once a CalR file exists, computes total data duration from the uploaded rows, and places upload QC cards beside the preview table on wider layouts.
- Upload QC checks for `rer` and `feed` are currently informative only; they do not block save or step navigation.
- The session step includes a session-completeness indicator for groups/diets, subjects, and ranges.
- During create, the upload step keeps the green dropzone completion state after CalR upload/conversion. During edit, the saved CalR file is shown with `Re-upload` and download actions instead.
- When editing an experiment that already has a saved CalR file, the upload dropzone is replaced with `Re-upload` and download actions. Re-upload keeps the same experiment and replaces the saved CalR file instead of creating a new one.
- When editing an experiment that already has a meaningful saved session file, the session dropzone is replaced with a download action; draft-only placeholder session state is ignored on reload.
- Metadata fields are config-driven from JSON, and required-for-public fields are marked visually with a legend/icon instead of inline text labels.
- On edit, the saved metadata `system` value also highlights the matching upload-system card until a new upload/re-upload flow starts.

## Analysis Data Flow

The analysis screens now use backend-enriched session data as the primary source of truth.

Current frontend analysis flow:

1. load session config from `GET /api/calr/sessions/{session_id}`
2. load enriched analysis data from `GET /api/calr/sessions/{session_id}/enriched`
3. normalize that payload with `normalizeEnrichedAnalysisData(...)`
4. pass the resulting `analysisData` into the plot-specific renderers

Shared private dataset entry points add one discovery step before the standard analysis flow:

1. resolve the shared dataset record from `GET /api/calr/shared/{submission_id}`
2. load session config from `GET /api/calr/sessions/{session_id}`
3. load enriched analysis data from `GET /api/calr/sessions/{session_id}/enriched`
4. normalize that payload with `normalizeEnrichedAnalysisData(...)`
5. pass the resulting `analysisData` into the plot-specific renderers

`analysisData` has the shared shape:

- `rows`: normalized analysis-ready detail rows
- `session`: normalized session/group/subject metadata used by plots and analysis controls

The frontend still keeps a few compatibility behaviors during normalization:

- parse enriched payloads returned as either JSON or CSV text
- fill stable numeric/time fields such as `exp.minute`, `exp.hour`, `day`, `light`, `dark`, and `clockHour`
- apply session-level exclusions from the backend session config
- preserve group, diet, color, and subject body-composition metadata used by plots
- preserve subject mass metadata returned in the session config, including total, lean, fat, and mass-change fields when available

## Plotting and Analysis

Plot-specific prep and Plotly rendering live in:

- [src/utils/plotting/time-series.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/time-series.js)
- [src/utils/plotting/box-plot.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/box-plot.js)
- [src/utils/plotting/regression.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/regression.js)
- [src/utils/plotting/weight.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/weight.js)
- [src/utils/plotting/qc.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/qc.js)
- [src/utils/plotting/power.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/power.js)
- [src/utils/plotting/summary-regression.js](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/src/utils/plotting/summary-regression.js)

QC, Power, and ANCOVA/ANOVA are backend-run analyses. The frontend sends requests to:

- `POST /api/calr/analysis/qc`
- `POST /api/calr/analysis/power`
- `POST /api/calr/analysis/ancova`

and renders the returned results in the analysis screen.

## Account Builder Flow

The account-side experiment builder currently supports:

- upload or convert instrument data into CalR CSV
- replace an existing saved CalR file during edit via `PUT /api/calr/files/{submission_id}`
- paginated preview of uploaded CalR rows in the upload step
- informative upload-side QC checks for:
  - `rer` values between `0.6` and `1.5`
  - non-negative `feed` values
- import a session CSV to hydrate groups, diets, subjects, exclusions, food cutoff, and subject mass fields
- edit existing experiments by loading the saved CalR CSV plus saved session data when that session is meaningful
- editing existing experiments with direct download access to the saved CalR and session files from the builder
- account-table readiness status loading that resolves incrementally after the file list is shown
- draft save behavior:
  - minimum draft save: experiment name, description, and converted CalR file
  - ready for analysis: draft requirements plus minimal session setup
  - ready for public: ready-for-analysis requirements plus required metadata fields
- session update behavior:
  - replace an existing saved session via `PUT /api/calr/sessions/{session_id}`
  - create a session during edit only when needed for meaningful draft session data or analysis-ready state
- subject designation with always-visible tables for groups, weights, mass change, and exclusions
- session completion tracking:
  - groups/diets are complete when every group has a name, color, and diet
  - subjects are complete when each group has at least one assigned subject
  - ranges are complete when light and dark cycle hours are no longer the default `0 / 0`
- config-driven metadata entry with:
  - JSON-defined fields
  - select and select-plus-free-text inputs
  - required-for-public markers used by the `Ready for Public` status
- template-based import helpers for weights and mass change, including blank CSV template download and CSV upload from the builder modal

## Current Status

### Working

- public and private dataset browsing
- shared private dataset browsing by share URL
- account-side create, edit, download, and open flows
- draft saves with CalR-only minimum requirements
- computed experiment readiness states in the account list and builder
- progressive account-list status hydration after initial dataset-list load
- account-side CalR preview pagination for large uploaded datasets
- account-side CalR replacement during edit
- enriched session loading for analysis
- session metadata editing and session upload/update flows
- config-driven experiment metadata form
- session completion indicator and analysis/public readiness gating
- per-dataset public and shared access toggles in the account list
- subject session CSV import and builder hydration
- subject weights and mass-change template import/export helpers
- time-series plot
- distribution plot
- regression plot
- weight plot
- QC plot
- power plot and tables
- ANCOVA / ANOVA summary tables
- community summary comparison plot

### Current Notes

- The current analysis path is backend-enriched first. Older local preprocessing paths have been removed from the analysis view.
- Shared links are generated from the current browser origin plus the hash-router analysis route; no deployment domain is hardcoded in the frontend.
- The analysis view now guards large datasets more carefully; `maxHour` is computed without array spreading to avoid call-stack failures on large sessions.
- The account builder now also avoids array-spread min/max patterns when deriving upload-side duration summaries from large CalR tables.
- Draft editing now distinguishes between meaningful saved session data and placeholder/default session state when deciding what to restore into the session editor.
- Plot parity work has recently aligned time-series, distribution, and regression behavior more closely with the legacy app.
- `JS_REBUILD_FILES_REFERENCE` is still the main behavior reference when checking rebuilt frontend logic against the older app.
- Avoid dataset-specific fixes unless a backend/data contract issue has been confirmed.

## Sample and Parity Files

Files used during backend/frontend parity checks live in:

- [sample_enriched](/Users/shilin/Documents/Projects/MouseCalR/_new/sample_data/calr_vue/sample_enriched)

These are reference artifacts only; they are not part of the runtime application flow.

## Backend Dependencies

This frontend depends on the live CalR backend APIs for:

- auth
- file listing
- shared dataset lookup
- experiment metadata
- public/share flag updates
- session config loading
- enriched session loading
- QC analysis
- power analysis
- ANCOVA analysis

The app is static-hostable, but runtime behavior still depends on those APIs being reachable and permitting the deployed frontend origin.

## Performance Notes

Some cleanup/performance work already in place:

- batched plot renders
- Plotly purge on unmount
- bounded shared derived-data caches
- reduced redundant analysis-path transformations

Large Plotly bundles are still present in production builds, so Vite may warn about chunk size during `npm run build`.

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
