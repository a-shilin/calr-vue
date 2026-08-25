# CalR Vue

Vue 3 + Vite frontend for browsing, configuring, and analyzing CalR datasets.

This app is a rebuild of the older single-file prototype preserved in [index.prototype.html](index.prototype.html).

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
npm run preview:live
```

- `npm run dev`: standard Vite dev server with hot module reload on the default dev port
- `npm run preview`: serves the built `dist` output for a production-like check; rebuild after changes
- `npm run preview:live`: hot-reload workflow on port `4173` so you can keep using a preview-style URL without rebuilding on every edit

## Routes

- `#/`: dashboard
- `#/account`: login/create-account flow plus account and experiment management
- `#/analysis`: dataset analysis
- `#/analysis?share={submission_id}`: shared private dataset analysis
- `#/community`: community summary comparison

The app uses hash routing for GitHub Pages compatibility.

## Current Structure

- [src/views](src/views): page-level screens
- [src/components/AnalysisPlotsPanel.vue](src/components/AnalysisPlotsPanel.vue): shared analysis plots panel used on both the analysis page and the account builder
- [src/components/MetadataFieldInput.vue](src/components/MetadataFieldInput.vue): shared text/select/select-plus-free-text metadata field input
- [src/utils/community-schema.js](src/utils/community-schema.js): standardized community column definitions, value normalization, and subject keys
- [src/config/experimentMetadata.json](src/config/experimentMetadata.json): data-only experiment metadata field definitions
- [src/router/index.js](src/router/index.js): app routes
- [src/services/registryService.js](src/services/registryService.js): live CalR backend API calls
- [src/utils/prep-for-analysis.js](src/utils/prep-for-analysis.js): normalize backend enriched payloads into frontend analysis data
- [src/utils/process.js](src/utils/process.js): shared session normalization, exclusions, outlier handling, and aggregation helpers
- [src/utils/plotting](src/utils/plotting): plot-specific renderers and plotting helpers
- [src/store/appStore.js](src/store/appStore.js): shared reactive app state
- [src/styles/app.css](src/styles/app.css): app styles

## Current UX Notes

- The main nav keeps `Account` right-aligned opposite the other primary routes.
- The account page owns authentication directly, with side-by-side login/create-account access.
- The analysis page always shows both `Public Datasets` and `Your Datasets` tabs.
- Before login, the `Your Datasets` tab shows an account-creation CTA instead of a dataset table.
- The account page shows the experiment list inline under a `Your Experiments` heading.
- The account experiment list includes a `State` column with three dots indicating data, session, and metadata completeness — each dot fills green when that section is complete.
- The account experiment list includes computed readiness states: `Draft`, `Ready for Analysis`, or `Ready for Public`.
- Account-side dataset rows render as soon as the file list is available, then status badges update progressively as session configs finish loading.
- The account experiment list includes `Public` and `Share` controls. Share is enabled only for datasets that are ready for analysis.
- Dataset tables on the analysis page are constrained in a scrollable container with a max height of 400px.
- In the analysis-page `Your Datasets` table, draft datasets show a status pill instead of an `Open` action.
- Dataset open actions show a spinner plus a percent-loaded indicator while enriched analysis data is downloading.
- Shared private dataset links open through `#/analysis?share={submission_id}`, show a percent-loaded indicator while loading, and render a `Private` pill in the dataset header.
- The account-side create/edit experiment flow is inline on the account page as a condensed one-page builder.
- Experiment name and description sit at the top of the builder and stay visible across the full create/edit flow.
- The builder header shows the current readiness state as a pill.
- Save, Share, and Contribute actions use checklist-style tooltips to show remaining requirements.
- The upload step shows a paginated CalR data preview once a CalR file exists, computes total data duration from the uploaded rows, and places upload QC cards beside the preview table on wider layouts.
- Upload QC checks for `rer` and `feed` are currently informative only; they do not block save or step navigation.
- Upload-file detection now distinguishes recognized `CLAMS` / `TSE` / `Sable` / `CalR` files from unrecognized inputs and shows an inline error state plus red dropzone styling for unsupported files.
- The session step includes a session-completeness indicator for groups/diets, subjects, and ranges.
- Session CSV upload now performs a lightweight recognition check before import. A session CSV must include `group_names` plus at least two `groupN` columns to be treated as recognized.
- During create, the upload step keeps the green dropzone completion state after CalR upload/conversion. During edit, the saved CalR file is shown with `Re-upload` and download actions instead.
- When editing an experiment that already has a saved CalR file, the upload dropzone is replaced with `Re-upload` and download actions. Re-upload keeps the same experiment and replaces the saved CalR file instead of creating a new one.
- When editing an experiment that already has a meaningful saved session file, the session section starts collapsed behind `Edit` / `Download Session`; draft-only placeholder session state is ignored on reload.
- Edit-state completion checkmarks appear next to saved CalR, saved session (only when session is analysis-complete), and full required metadata.
- Metadata fields are config-driven from JSON.
- On edit, the saved metadata `system` value also highlights the matching upload-system card until a new upload/re-upload flow starts.
- The session-side food cutoff QC now follows the same pass/fail card pattern as the upload-side QC cards. Before groups and diets are configured, the food-cutoff minimum stays at `0` and the QC card stays hidden.
- Builder-side `Share` and `Contribute` controls appear only after the experiment has a persisted backend record.
- Builder-side `Contribute` now opens a modal with the public-repository toggle instead of toggling immediately.

## Builder Save and Transition Flow

After a successful save from the create-new-experiment flow:

1. The page switches to edit mode immediately using in-memory data — no waiting for API responses.
2. The session section transitions to edit mode instantly (download/edit controls, no dropzone).
3. The session config is fetched from the backend in the background and the builder hydrates once it arrives.
4. If the saved experiment is analysis-ready, the analysis section appears with a loading indicator immediately, and plots render once data arrives.

After a save from the edit flow (including saving a session for the first time on a draft):

1. If a new session file was created, `editingSessionId` is updated from the upload response so subsequent saves update the existing session rather than creating a new one.
2. The session section transitions to edit mode immediately.
3. If the experiment is now analysis-ready, the analysis section appears with a loading indicator and plots render in the background.

## Analysis Plots Panel

`AnalysisPlotsPanel` is a shared component used on both the analysis page and the account builder. It accepts:

- `analysisData` — normalized rows + session metadata
- `sessionMetadata` — session/group/subject metadata
- `maxHour` — experiment duration
- `groupColors` — `{ groupName: hexColor }` map
- `analysisOptions` — `{ removeOutliers }` reactive options object
- `context` — `'experiment'` (default) or `'builderAnalysis'`; routes store access to the correct analysis slice
- `defaultViewMode` — `'stacked'` (default) or `'single'`

The panel renders above the plot nav:

- A **session stats bar** — subjects, duration, light/dark cycle hours, and remove-outliers toggle
- **Group cards** — one per group, showing color swatch, name, diet, kcal/g, and subject count

Plot rendering uses double `requestAnimationFrame` batching with per-plot loading spinners. Plotly containers are kept in the DOM via `v-show` (not `v-if`) to prevent Plotly from losing its mount target. `Plotly.Plots.resize()` is called after all plots render to correct container-width measurement issues.

The `store` has two parallel analysis slices:

- `store.experiment` — used by the analysis page (`context='experiment'`)
- `store.builderAnalysis` — used by the account builder (`context='builderAnalysis'`)

Loader flags (`doQC`, `doAncova`, `doPower`, `doBuilderQC`, `doBuilderAncova`, `doBuilderPower`) are routed to the correct slice based on `context`.

## Community Page

The community page compares subject-level summary rows across public datasets. It loads
`public/02032026_combined_datasets_calrepo.csv` directly and does not use the backend APIs.

Column definitions live in [src/utils/community-schema.js](src/utils/community-schema.js). The
community CSV follows a published column standard, so the variable lists there are explicit rather
than inferred from the loaded file — new columns reach the app by being added to the standard and
then listed in that module.

### Data grain

One row per `(experiment_id, subject_id, experiment_start_time, time_of_day)`. That composite is the
only unique key in the file:

- `subject_id` is unique only within an experiment; some ids are reused across experiments.
- One animal can be recorded in several sessions, and those sessions can differ in condition
  (`CalR000171` records the same animals at both 4 °C and 23 °C). Repeated sessions plot as separate
  points, because averaging them would erase the contrast the data exists to show.
- Every animal appears once per photoperiod, so plotting without a photoperiod filter draws each
  animal three times.

`animalKey` counts distinct animals; `subjectKey` identifies a plotted point.

### Photoperiod

A single-select `Light` / `Dark` / `Full day` control, defaulting to `Full day`. Selecting one
photoperiod is required for the plot to show one point per animal-session.

### Value normalization

Categorical values are canonicalized once at load. Spellings that differ only by case, punctuation,
or spacing fold onto the most frequent variant, so they do not split into separate filters, legend
entries, and colors; values that differ by actual words are left alone. Missing-value tokens
(`NA`, `N/A`, `NaN`, `null`, blank) become empty rather than reading as real categories. `none` is
preserved, since "no treatment" and "no enrichment" are real values.

### Variable availability

Column coverage varies widely by experiment — lean/fat mass are absent from most, `wheel_counts`
from all but two. A variable is offered only when it has at least two distinct finite values in the
current selection; otherwise it is disabled and marked `no data`, so a selection cannot silently
produce an empty plot.

### Color

`Group / Color By` accepts both categorical and numeric columns.

Categorical columns take a 30-entry qualitative palette, sized for the largest real case — a strain
survey carries 30 levels.

Numeric columns offer three color scales:

- `Gradient` — continuous per-point color with a viridis colorbar
- `Grouped — natural breaks` — discrete levels split where the data is already separated
- `Grouped — rounded values` — one level per rounded value

Grouped levels are spread along the same continuous scale, so their order stays readable as a ramp
instead of arbitrary categorical colors.

Natural-break binning splits at the widest gaps in the distribution rather than at fixed-width or
quantile boundaries, because cohort designs leave wide empty stretches between groups that
equal-width bins cut straight through. Gaps must exceed 5% of the variable's range to count, and
levels holding fewer than 1% of points (minimum 3) fold into their neighbour so a handful of stray
animals cannot add a meaningless legend entry.

Bins, level order, and colors are derived once over the whole selection, so Group A, Group B, and the
two side-by-side panels always agree on what a color means.

### Presets

Preset definitions live in [src/config/communityPresets.js](src/config/communityPresets.js) and sit
in a row between the plot filters and the plot, each showing a title and a description of what it is
meant to show.

A preset sets **variable roles only** — photoperiod, X, Y, color, color scale, facet, fit type, fit
scope, equations. It never names a dataset or a filter value, so every preset stays usable on any
dataset that follows the standard, including ones added later. Where a reference figure also needed a
particular subset of animals, the preset states that in `manualStep` rather than encoding values that
differ between experiments.

Each preset declares the columns it `requires`, so it is offered only when the current selection can
actually support it and otherwise explains what is missing. Presets that facet also require that
column to have between 2 and 12 levels.

The highlighted preset is derived from the live plot settings rather than stored, so it always
reflects real state and stops matching as soon as anything is changed by hand.

Applying a preset moves several watched settings at once, so plot rendering is coalesced to one draw
per tick.

### Plot filters

The plot filter bar sits between the dataset tables and the plot. Its scope is deliberately distinct
from the Group A / Group B filter popovers: those choose which *datasets* are in play, while these
subset the *rows that are plotted*, across any categorical column.

Filtered-out points are not discarded. They render as high-transparency grey context so the excluded
population stays visible, and are excluded from every fit and from the color scale. A
`Show filtered points` toggle hides them. Ghost points never win closest-point hover, which would
otherwise make the visible points hard to inspect.

Bins, level order, and gradient extent are computed from the kept rows only, so filtering does not
drag the color scale around. Axis ranges are computed from the full selection instead, so the view
does not jump as filters are toggled.

### Faceting

`Facet By` splits the plot into a panel grid on any categorical column, nested inside the existing
Group A / Group B overlay and side-by-side modes. Panels use real Plotly subplots with shared,
matched axes, ggplot-style strip labels, and a single legend — each series appears once in the legend
and its `legendgroup` toggles that series across every panel.

Faceting is offered only for columns with between 2 and 12 distinct values in the current selection;
beyond that the grid is unreadable, and a strain survey would ask for 30 panels. The control reports
why a column is unavailable (`30 panels`, `one value`), and the current facet column is cleared
automatically if a selection or filter change makes it invalid.

Panels come from rows that survived filtering, so a filtered-away level gets no panel. Ghost points
follow from that: a ghost whose own facet level was filtered out has nowhere to be drawn and is
dropped, while a ghost excluded by some *other* column still appears in its own panel.

### Fits

Fit type is `None`, `Linear (OLS)`, or `Loess`. Loess is a tricubic-weighted local linear smoother
implemented in [src/utils/plotting/fits.js](src/utils/plotting/fits.js), matching
`geom_smooth(method="loess")` with `span=1`; there is no smoothing dependency in the app.

Fit scope is independent of fit type:

- `Per color group` — one fit per color level
- `Single overall fit` — one dark fit across all points, leaving color free to show a different
  variable

A gradient color scale has no discrete groups, so scope is forced to overall while it is active.

Linear fits can print their equation and R² on the plot.

### Dataset tables

Each experiment row shows distinct animal count plus metadata summarized across all of that
experiment's rows: numeric spreads render as ranges (`4–23`), and categorical columns show up to two
distinct values before collapsing to a count. Reading metadata off the first row would misreport any
experiment that spans several recording conditions.

## Analysis Page Dataset Info

The dataset info panel on the analysis page shows:

- Experiment name and description as title/subtitle
- A **Show/Hide Metadata** toggle that reveals the full config-driven metadata fields (same layout as the account builder, read-only with `—` for empty fields)
- A **Private** pill for shared-link datasets

Session stats, group cards, and plot controls live inside the `AnalysisPlotsPanel` component below the info panel.

## Analysis Data Flow

The analysis screens use backend-enriched session data as the primary source of truth.

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

- [src/utils/plotting/time-series.js](src/utils/plotting/time-series.js)
- [src/utils/plotting/box-plot.js](src/utils/plotting/box-plot.js)
- [src/utils/plotting/regression.js](src/utils/plotting/regression.js)
- [src/utils/plotting/weight.js](src/utils/plotting/weight.js)
- [src/utils/plotting/qc.js](src/utils/plotting/qc.js)
- [src/utils/plotting/power.js](src/utils/plotting/power.js)
- [src/utils/plotting/summary-regression.js](src/utils/plotting/summary-regression.js)

QC, Power, and ANCOVA/ANOVA are backend-run analyses. The frontend sends requests to:

- `POST /api/calr/analysis/qc`
- `POST /api/calr/analysis/power`
- `POST /api/calr/analysis/ancova`

and renders the returned results in the analysis screen.

## Account Builder Flow

The account-side experiment builder currently supports:

- upload or convert instrument data into CalR CSV
- upload-side file-format detection for supported `CLAMS`, `TSE`, `Sable`, and `CalR` files, including inline unrecognized-file feedback
- replace an existing saved CalR file during edit via `PUT /api/calr/files/{submission_id}`
- paginated preview of uploaded CalR rows in the upload step
- informative upload-side QC checks for:
  - `rer` values between `0.6` and `1.5`
  - non-negative `feed` values
- import a session CSV to hydrate groups, diets, subjects, exclusions, food cutoff, and subject mass fields
- session CSV recognition checks that require `group_names` plus at least two `groupN` columns before import
- edit existing experiments by loading the saved CalR CSV plus saved session data when that session is meaningful
- editing existing experiments with direct download access to the saved CalR and session files from the builder
- builder-side share action for persisted experiments via modal
- builder-side contribute action for persisted experiments via modal
- account-table readiness status loading that resolves incrementally after the file list is shown
- draft save behavior:
  - minimum draft save: experiment name, description, and converted CalR file
  - ready for analysis: draft requirements plus minimal session setup
  - ready for public: ready-for-analysis requirements plus required metadata fields
- session update behavior:
  - replace an existing saved session via `PUT /api/calr/sessions/{session_id}`
  - create a session during edit only when needed for meaningful draft session data or analysis-ready state
  - after first-time session upload during edit, `editingSessionId` is updated from the upload response
- subject designation with always-visible tables for groups, weights, mass change, and exclusions
- session completion tracking:
  - groups/diets are complete when every group has a name, color, and diet
  - subjects are complete when each group has at least one assigned subject
  - ranges are complete when light and dark cycle hours are no longer the default `0 / 0`
- food cutoff behavior:
  - cutoff defaults to `0` until groups/diets are configured
  - once groups/diets are configured, the default cutoff is derived from the selected diet calories rather than a hardcoded cutoff lookup table
- config-driven metadata entry with:
  - JSON-defined fields
  - select and select-plus-free-text inputs
  - `Ready for Public` gating driven by required metadata completion
- template-based import helpers for weights and mass change, including blank CSV template download and CSV upload from the builder modal
- edit-state completion checkmarks for saved CalR, saved session (only when session is fully analysis-complete), and full required metadata

## Current Status

### Working

- public and private dataset browsing
- login and create-account flow on the account page
- shared private dataset browsing by share URL
- account-side create, edit, download, and open flows
- draft saves with CalR-only minimum requirements
- computed experiment readiness states in the account list and builder
- progressive account-list status hydration after initial dataset-list load
- progressive private-dataset status hydration on the analysis page
- account-side CalR preview pagination for large uploaded datasets
- account-side CalR replacement during edit
- enriched session loading for analysis
- session metadata editing and session upload/update flows
- config-driven experiment metadata form
- session completion indicator and analysis/public readiness gating
- builder action requirement checklists in save/share/contribute tooltips
- per-dataset public and shared access toggles in the account list
- upload-file recognition and unrecognized-file handling
- subject session CSV import and builder hydration
- session CSV recognition checks before import
- subject weights and mass-change template import/export helpers
- instant post-save transition to edit mode (no API round-trip before UI switches)
- analysis section auto-loads after save when experiment is analysis-ready
- analysis plots panel embedded in account builder for in-context analysis
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
- Builder `Share` / `Contribute` actions are intentionally saved-record-only even though their checklist tooltips can describe readiness before save.
- Plot parity work has recently aligned time-series, distribution, and regression behavior more closely with the legacy app.
- `JS_REBUILD_FILES_REFERENCE` is still the main behavior reference when checking rebuilt frontend logic against the older app.
- Avoid dataset-specific fixes unless a backend/data contract issue has been confirmed.

## Sample and Parity Files

Files used during backend/frontend parity checks live in:

- [sample_enriched](sample_enriched)

These are reference artifacts only; they are not part of the runtime application flow.

## Backend Dependencies

This frontend depends on the live CalR backend APIs for:

- auth
- account creation
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

- batched plot renders with double `requestAnimationFrame` scheduling
- per-plot loading spinners with pre-marked spinner state so all plot spinners appear simultaneously
- `Plotly.Plots.resize()` pass after all renders to correct container-width measurement
- Plotly purge on unmount
- bounded shared derived-data caches
- reduced redundant analysis-path transformations

Large Plotly bundles are still present in production builds, so Vite may warn about chunk size during `npm run build`.

## GitHub Pages

This repo includes a GitHub Pages workflow at [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

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

- [index.prototype.html](index.prototype.html)
- [JS_REBUILD_FILES_REFERENCE](JS_REBUILD_FILES_REFERENCE)
