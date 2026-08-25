<template>
  <div class="page-column" style="gap:20px;">
    <div class="page-header">
      <p class="page-kicker">Community Repository</p>
      <h1 class="page-title">Compare Results</h1>
      <p class="page-subtitle">Select datasets from both Group A and Group B to compare their summary results.</p>
    </div>
    <section class="panel panel--spaced">
      <div class="plot-section">
        <div class="plot-section__header">
          <span class="panel-label">Datasets</span>
        </div>
        <div class="community-groups">
          <!-- Group A -->
          <div class="community-group">
            <span class="section-title">Group A</span>
            <div class="dataset-table-toolbar">
              <div style="display:flex; gap:8px; align-items:center;">
                <button
                  ref="groupAFilterButton"
                  class="btn btn-sm"
                  :class="groupAActiveFilterCount ? 'btn-secondary' : 'btn-outline-secondary'"
                  @click.stop="toggleGroupAFilters"
                >
                  Filter<span v-if="groupAActiveFilterCount"> ({{ groupAActiveFilterCount }})</span>
                </button>
                <input
                  v-model="groupASearch"
                  type="text"
                  class="form-control form-control-sm dataset-table-search-input"
                  placeholder="Search Group A"
                />
              </div>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-outline-secondary btn-sm" @click="selectAllGroupA">Select All</button>
                <button class="btn btn-outline-secondary btn-sm" @click="selectedExperiments = []">Clear</button>
              </div>
            </div>

            <div
              ref="groupATableScroll"
              class="community-table-scroll"
              :class="{ 'community-table-scroll--overflowing': groupATableOverflowing }"
              @scroll="updateGroupAOverflow"
            >
              <BTable
                v-if="filteredGroupAItems.length"
                :items="filteredGroupAItems"
                :fields="communityTableFields"
                small
                hover
                striped
                class="dataset-table community-table"
                @row-clicked="(item) => toggleGroupA(item.experiment_id)"
              >
                <template #cell(selected)="slot">
                  <input
                    type="checkbox"
                    :checked="selectedExperiments.includes(slot.item.experiment_id)"
                    :disabled="highlightedExperiments.includes(slot.item.experiment_id)"
                    @change="toggleGroupA(slot.item.experiment_id)"
                  />
                </template>
              </BTable>
              <div v-else class="empty-state dataset-table-empty-state">
                No matching datasets found.
              </div>
            </div>
          </div>

          <!-- Group B -->
          <div class="community-group">
            <span class="section-title">Group B</span>
            <div class="dataset-table-toolbar">
              <div style="display:flex; gap:8px; align-items:center;">
                <button
                  ref="groupBFilterButton"
                  class="btn btn-sm"
                  :class="groupBActiveFilterCount ? 'btn-secondary' : 'btn-outline-secondary'"
                  @click.stop="toggleGroupBFilters"
                >
                  Filter<span v-if="groupBActiveFilterCount"> ({{ groupBActiveFilterCount }})</span>
                </button>
                <input
                  v-model="groupBSearch"
                  type="text"
                  class="form-control form-control-sm dataset-table-search-input"
                  placeholder="Search Group B"
                />
              </div>
              <div style="display:flex; gap:6px;">
              
                <button class="btn btn-outline-secondary btn-sm" @click="selectAllGroupB">Select All</button>
                <button class="btn btn-outline-secondary btn-sm" @click="highlightedExperiments = []">Clear</button>
              </div>
            </div>

            <div
              ref="groupBTableScroll"
              class="community-table-scroll"
              :class="{ 'community-table-scroll--overflowing': groupBTableOverflowing }"
              @scroll="updateGroupBOverflow"
            >
              <BTable
                v-if="filteredGroupBItems.length"
                :items="filteredGroupBItems"
                :fields="communityTableFields"
                small
                hover
                striped
                class="dataset-table community-table"
                @row-clicked="(item) => toggleGroupB(item.experiment_id)"
              >
                <template #cell(selected)="slot">
                  <input
                    type="checkbox"
                    :checked="highlightedExperiments.includes(slot.item.experiment_id)"
                    :disabled="selectedExperiments.includes(slot.item.experiment_id)"
                    @change="toggleGroupB(slot.item.experiment_id)"
                  />
                </template>
              </BTable>
              <div v-else class="empty-state dataset-table-empty-state">
                No matching datasets found.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!--
        Plot-level filters. These subset the rows that are plotted, which is a
        different scope from the Group A / Group B filters above — those choose
        which datasets are in play at all.
      -->
      <div class="plot-section">
        <div class="plot-section__header">
          <span class="panel-label">Plot Filters</span>
        </div>
        <div class="plot-filter-bar">
          <button
            ref="plotFilterButton"
            class="btn btn-sm"
            :class="activePlotFilterCount ? 'btn-secondary' : 'btn-outline-secondary'"
            @click.stop="togglePlotFilters"
          >
            Add Filter<span v-if="activePlotFilterCount"> ({{ activePlotFilterCount }})</span>
          </button>

          <div class="plot-filter-bar__chips">
            <span v-for="chip in plotFilterChips" :key="chip.key" class="plot-filter-chip">
              <strong>{{ chip.label }}:</strong>
              <span class="plot-filter-chip__values">{{ chip.summary }}</span>
              <button
                type="button"
                class="plot-filter-chip__remove"
                :aria-label="`Clear ${chip.label} filter`"
                @click="clearPlotFilter(chip.key)"
              >
                ×
              </button>
            </span>
            <span v-if="!plotFilterChips.length" class="muted-copy">
              No plot filters — all selected animals are shown.
            </span>
          </div>

          <label v-if="activePlotFilterCount" class="checkbox-row plot-filter-bar__ghosts">
            <input v-model="showGhosts" type="checkbox" />
            Show filtered points
          </label>
          <button
            v-if="activePlotFilterCount"
            class="btn btn-outline-secondary btn-sm"
            @click="clearAllPlotFilters"
          >
            Clear
          </button>
        </div>
      </div>

      <!--
        Presets set variable roles only. They never name a dataset or a filter
        value, so each one stays usable on any dataset that follows the standard.
      -->
      <div class="plot-section">
        <div class="plot-section__header">
          <span class="panel-label">Presets</span>
          <button
            v-if="activePresetId"
            class="btn btn-link btn-sm plot-section__action"
            @click="clearPreset"
          >
            Reset to defaults
          </button>
        </div>
        <div class="preset-cards">
          <button
            v-for="preset in presetCards"
            :key="preset.id"
            type="button"
            class="preset-card"
            :class="{
              'preset-card--active': preset.id === activePresetId,
              'preset-card--unavailable': !preset.available,
            }"
            :disabled="!preset.available"
            @click="applyPreset(preset)"
            @mouseenter="showPresetTooltip(preset, $event)"
            @mouseleave="hidePresetTooltip"
            @focus="showPresetTooltip(preset, $event)"
            @blur="hidePresetTooltip"
          >
            <strong class="preset-card__title">{{ preset.title }}</strong>
            <span v-if="!preset.available" class="preset-card__warning">
              Needs {{ preset.missingLabels.join(', ') }}
            </span>
          </button>
        </div>
      </div>

      <div class="plot-section">
        <div class="plot-section__header">
          <span class="panel-label">Regression</span>
        </div>
        <section class="plot-row plot-row--reverse">
          <aside class="controls-panel">
            <span class="panel-label">Variables</span>
            <label class="control-stack">
              Photoperiod
              <select v-model="photoperiod">
                <option v-for="period in photoperiods" :key="period" :value="period">{{ period }}</option>
              </select>
            </label>
            <label class="control-stack">
              X Variable
              <select v-model="xVar">
                <option
                  v-for="variable in numericVarOptions"
                  :key="variable.key"
                  :value="variable.key"
                  :disabled="!variable.available"
                >
                  {{ variable.label }}{{ variable.available ? '' : ' — no data' }}
                </option>
              </select>
            </label>
            <label class="control-stack">
              Y Variable
              <select v-model="yVar">
                <option
                  v-for="variable in numericVarOptions"
                  :key="variable.key"
                  :value="variable.key"
                  :disabled="!variable.available"
                >
                  {{ variable.label }}{{ variable.available ? '' : ' — no data' }}
                </option>
              </select>
            </label>
            <label class="control-stack">
              Group / Color By
              <select v-model="groupVar">
                <optgroup label="Categorical">
                  <option
                    v-for="variable in categoricalVarOptions"
                    :key="variable.key"
                    :value="variable.key"
                    :disabled="!variable.available"
                  >
                    {{ variable.label }}{{ variable.available ? '' : ' — no data' }}
                  </option>
                </optgroup>
                <optgroup label="Numeric">
                  <option
                    v-for="variable in numericVarOptions"
                    :key="variable.key"
                    :value="variable.key"
                    :disabled="!variable.available"
                  >
                    {{ variable.label }}{{ variable.available ? '' : ' — no data' }}
                  </option>
                </optgroup>
              </select>
            </label>
            <label v-if="isNumericColor" class="control-stack">
              Color Scale
              <select v-model="numericColorMode">
                <option v-for="mode in numericColorModes" :key="mode.key" :value="mode.key">
                  {{ mode.label }}
                </option>
              </select>
            </label>
            <p v-if="isNumericColor && !isGradientColor && colorDomain.length" class="muted-copy" style="margin:0;">
              {{ colorDomain.length }} levels
            </p>
            <label class="control-stack">
              Facet By
              <select v-model="facetBy">
                <option value="">None</option>
                <option
                  v-for="variable in facetVarOptions"
                  :key="variable.key"
                  :value="variable.key"
                  :disabled="!variable.available"
                >
                  {{ variable.label }}{{ variable.available ? '' : ` — ${variable.reason}` }}
                </option>
              </select>
            </label>

            <span class="panel-label">Fit</span>
            <label class="control-stack">
              Fit Type
              <select v-model="fitType">
                <option value="none">None</option>
                <option value="linear">Linear (OLS)</option>
                <option value="loess">Loess</option>
              </select>
            </label>
            <label v-if="fitType !== 'none'" class="control-stack">
              Fit Scope
              <select :value="effectiveFitScope" :disabled="isGradientColor" @change="fitScope = $event.target.value">
                <option value="group">Per color group</option>
                <option value="overall">Single overall fit</option>
              </select>
            </label>
            <p v-if="fitType !== 'none' && isGradientColor" class="muted-copy" style="margin:0;">
              A gradient has no discrete groups to fit separately. Switch the color scale to a grouped
              mode for per-group fits.
            </p>
            <label v-if="fitType === 'linear'" class="checkbox-row">
              <input v-model="showEquations" type="checkbox" />
              Show equations
            </label>

            <p v-if="hasSelection" class="muted-copy" style="margin:0;">
              {{ selectionStats.animals }} animals · {{ selectionStats.points }} plotted<template
                v-if="selectionStats.filtered"
              >
                · {{ selectionStats.filtered }} filtered out</template><template
                v-if="selectionStats.incomplete"
              >
                · {{ selectionStats.incomplete }} missing data</template>
            </p>
          </aside>

          <div class="panel plot-panel plot-panel--grows">
            <div class="community-plot-header">
              <div v-if="hasBothGroups" class="plots-view-toggle">
                <button class="view-toggle-btn" :class="{ active: plotMode === 'overlay' }" @click="setPlotMode('overlay')">Overlay</button>
                <button class="view-toggle-btn" :class="{ active: plotMode === 'side-by-side' }" @click="setPlotMode('side-by-side')">Side by Side</button>
              </div>
            </div>
            <div v-if="!hasSelection" class="d-flex align-items-center justify-content-center h-100 text-muted">
              Select at least one dataset to view the plot.
            </div>
            <div
              v-else-if="unavailableSelectedVariables.length"
              class="d-flex align-items-center justify-content-center h-100 text-muted text-center"
            >
              The selected datasets have no data for
              {{ unavailableSelectedVariables.map((variable) => variable.label).join(' or ') }}.
              Pick another variable or add a dataset that measured it.
            </div>
            <div
              v-else-if="!plottedRows.length"
              class="d-flex align-items-center justify-content-center h-100 text-muted text-center"
            >
              <template v-if="activePlotFilterCount">No animals match the current plot filters.</template>
              <template v-else>
                No animals in the selected datasets have values for both plotted variables.
              </template>
            </div>
            <template v-else>
              <div v-if="plotMode === 'overlay'" ref="summaryPlot" class="plot-surface"></div>
              <div v-else class="community-side-by-side">
                <div class="community-side-plot">
                  <div class="muted-copy" style="text-align:center; margin-bottom:4px;">Group A</div>
                  <div ref="summaryPlotA" class="plot-surface"></div>
                </div>
                <div class="community-side-plot">
                  <div class="muted-copy" style="text-align:center; margin-bottom:4px;">Group B</div>
                  <div ref="summaryPlotB" class="plot-surface"></div>
                </div>
              </div>
            </template>
          </div>
        </section>
      </div>

      <Teleport to="body">
        <div
          v-if="showGroupAFilters"
          ref="groupAFilterPopover"
          class="dataset-table-filter-popover"
          :style="groupAFilterPopoverStyle"
        >
          <DatasetTableFilterPopover
            :fields="filterFields"
            :filters="groupAFilters"
            @toggle-categorical="toggleGroupAFilter"
            @clear-field="clearGroupAFilter"
          />
        </div>
      </Teleport>

      <Teleport to="body">
        <div
          v-if="showGroupBFilters"
          ref="groupBFilterPopover"
          class="dataset-table-filter-popover"
          :style="groupBFilterPopoverStyle"
        >
          <DatasetTableFilterPopover
            :fields="filterFields"
            :filters="groupBFilters"
            @toggle-categorical="toggleGroupBFilter"
            @clear-field="clearGroupBFilter"
          />
        </div>
      </Teleport>

      <Teleport to="body">
        <div
          v-if="presetTooltip"
          ref="presetTooltip"
          class="preset-tooltip"
          role="tooltip"
          :style="presetTooltipStyle"
        >
          {{ presetTooltip }}
        </div>
      </Teleport>

      <Teleport to="body">
        <div
          v-if="showPlotFilters"
          ref="plotFilterPopover"
          class="dataset-table-filter-popover"
          :style="plotFilterPopoverStyle"
        >
          <DatasetTableFilterPopover
            :fields="plotFilterFields"
            :filters="plotFilters"
            @toggle-categorical="togglePlotFilter"
            @update-range="updatePlotFilterRange"
            @clear-field="clearPlotFilter"
          />
        </div>
      </Teleport>
    </section>
  </div>
</template>

<script>
import { appStore } from '../store/appStore'
import { COMMUNITY_PRESETS } from '../config/communityPresets'
import {
  CATEGORICAL_VARS,
  DEFAULT_NUMERIC_COLOR_MODE,
  DEFAULT_PHOTOPERIOD,
  NUMERIC_COLOR_MODES,
  NUMERIC_VARS,
  PHOTOPERIODS,
  animalKey,
  buildAnimalCountMap,
  buildNumericBins,
  computeNumericAvailability,
  computeNumericRange,
  filterByPhotoperiod,
  isMissingValue,
  labelFor,
  normalizeCommunityRows,
  toFiniteNumber,
} from '../utils/community-schema'
import { parseCsv, preprocessSummary } from '../utils/csv'
import { buildSeriesColors } from '../utils/plotting/community-color'
import { purgePlot } from '../utils/plotting/core'
import { renderSummaryRegressionPlot } from '../utils/plotting/summary-regression'
import DatasetTableFilterPopover from '../components/DatasetTableFilterPopover.vue'

const summaryCsvUrl = `${import.meta.env.BASE_URL}02032026_combined_datasets_calrepo.csv`
const FILTER_KEYS = ['sex', 'system', 'strain', 'location']

// Metadata shown per experiment in the dataset tables. An experiment can span
// several recording sessions with different conditions, so these are summarized
// across all of its rows rather than read off the first one.
const META_COLUMNS = [
  'investigator',
  'system',
  'location',
  'sex',
  'strain',
  'genetic_background',
  'species',
  'age',
  'diet_name',
  'diet_kcal_g',
  'treatment',
  'ambient_temperature_c',
  'litter',
  'bedding',
  'ee_calculation_method',
  'enrichment',
  'experiment_duration_hr',
  'pmid',
]

const NUMERIC_META_COLUMNS = new Set([
  'age',
  'diet_kcal_g',
  'ambient_temperature_c',
  'experiment_duration_hr',
])

function formatMetaNumber(value) {
  return Number.isInteger(value) ? `${value}` : Number(value.toFixed(2)).toString()
}

// Collapse an experiment's values for one column into a single cell: a lone
// value as-is, a numeric spread as a range, and anything wider as a count.
function summarizeMetaValues(values, key) {
  if (NUMERIC_META_COLUMNS.has(key)) {
    const numbers = values.map(toFiniteNumber).filter((value) => value !== null)

    if (!numbers.length) {
      return ''
    }

    const min = Math.min(...numbers)
    const max = Math.max(...numbers)
    return min === max ? formatMetaNumber(min) : `${formatMetaNumber(min)}–${formatMetaNumber(max)}`
  }

  const distinct = [...new Set(values.filter((value) => !isMissingValue(value)).map((value) => `${value}`.trim()))]

  if (!distinct.length) {
    return ''
  }

  if (distinct.length === 1) {
    return distinct[0]
  }

  if (distinct.length === 2) {
    return distinct.join(', ')
  }

  return `${distinct.length} values`
}

function emptyFilters() {
  return Object.fromEntries(FILTER_KEYS.map((k) => [k, { selectedValues: [] }]))
}

// Plot-level filters cover the same variable pool the plot itself draws on:
// numeric measurements as ranges, categorical metadata as value lists. The
// dataset selection filters are a fixed handful of categorical columns instead.
function emptyPlotFilters() {
  return {
    ...Object.fromEntries(NUMERIC_VARS.map(({ key }) => [key, {}])),
    ...Object.fromEntries(CATEGORICAL_VARS.map(({ key }) => [key, { selectedValues: [] }])),
  }
}

const NUMERIC_KEYS = new Set(NUMERIC_VARS.map(({ key }) => key))

function formatFilterNumber(value, step) {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)))
  return Number(value.toFixed(decimals)).toString()
}

// Past this many panels a facet grid is unreadable, and a strain survey would
// ask for 30 of them.
const MAX_FACET_LEVELS = 12

function buildCommunityGroupCountMap(summaryRows = []) {
  const counts = new Map()

  summaryRows.forEach((row) => {
    const experimentId = `${row?.experiment_id || ''}`.trim()
    const group = `${row?.group || row?.Group || ''}`.trim()

    if (!experimentId || !group) {
      return
    }

    if (!counts.has(experimentId)) {
      counts.set(experimentId, new Set())
    }

    counts.get(experimentId).add(group)
  })

  return new Map([...counts.entries()].map(([experimentId, groups]) => [experimentId, groups.size]))
}

export default {
  name: 'CommunityView',
  components: { DatasetTableFilterPopover },
  data() {
    return {
      store: appStore,
      photoperiods: PHOTOPERIODS,
      photoperiod: DEFAULT_PHOTOPERIOD,
      numericColorModes: NUMERIC_COLOR_MODES,
      numericColorMode: DEFAULT_NUMERIC_COLOR_MODE,
      fitType: 'linear',
      fitScope: 'group',
      showEquations: false,
      facetBy: '',
      plotFilters: emptyPlotFilters(),
      showPlotFilters: false,
      showGhosts: true,
      plotFilterPopoverPosition: { top: 0, left: 0 },
      presetTooltip: '',
      presetTooltipPosition: { top: 0, left: 0 },
      presetTooltipAnchor: null,
      renderScheduled: false,
      xVar: 'body_mass_g',
      yVar: 'energy_expenditure_kcal_hr',
      groupVar: 'group',
      selectedExperiments: [],
      highlightedExperiments: [],
      groupASearch: '',
      groupBSearch: '',
      showGroupAFilters: false,
      showGroupBFilters: false,
      groupAFilterPopoverPosition: { top: 0, left: 0 },
      groupBFilterPopoverPosition: { top: 0, left: 0 },
      groupAFilters: emptyFilters(),
      groupBFilters: emptyFilters(),
      groupATableOverflowing: false,
      groupBTableOverflowing: false,
      plotMode: 'overlay',
    }
  },
  computed: {
    communityTableFields() {
      return [
        { key: 'experiment_id', label: 'Experiment' },
        { key: 'animals', label: 'Animals' },
        { key: 'groupCount', label: 'Groups' },
        { key: 'investigator', label: 'Investigator' },
        { key: 'system', label: 'System' },
        { key: 'location', label: 'Institution' },
        { key: 'sex', label: 'Sex' },
        { key: 'strain', label: 'Strain' },
        { key: 'genetic_background', label: 'Background' },
        { key: 'species', label: 'Species' },
        { key: 'age', label: 'Age (weeks)' },
        { key: 'diet_name', label: 'Diet' },
        { key: 'diet_kcal_g', label: 'kcal/g' },
        { key: 'treatment', label: 'Treatment' },
        { key: 'ambient_temperature_c', label: 'Temp (°C)' },
        { key: 'litter', label: 'Litter' },
        { key: 'bedding', label: 'Bedding' },
        { key: 'ee_calculation_method', label: 'EE Method' },
        { key: 'enrichment', label: 'Enrichment' },
        { key: 'experiment_duration_hr', label: 'Duration (hr)' },
        { key: 'pmid', label: 'PMID' },
        { key: 'selected', label: '', thClass: 'dataset-table__actions-cell community-table__checkbox-cell', tdClass: 'dataset-table__actions-cell community-table__checkbox-cell' },
      ]
    },
    experimentTableRows() {
      const summaryRows = this.store.community.summaryRows
      const groupCounts = buildCommunityGroupCountMap(summaryRows)
      const animalCounts = buildAnimalCountMap(summaryRows)
      const collected = new Map()

      summaryRows.forEach((row) => {
        const experimentId = `${row.experiment_id ?? ''}`.trim()

        if (!experimentId) {
          return
        }

        if (!collected.has(experimentId)) {
          collected.set(experimentId, new Map(META_COLUMNS.map((key) => [key, []])))
        }

        const columns = collected.get(experimentId)
        META_COLUMNS.forEach((key) => columns.get(key).push(row[key]))
      })

      return [...collected.entries()].map(([experimentId, columns]) => {
        const tableRow = {
          experiment_id: experimentId,
          animals: animalCounts.get(experimentId) ?? 0,
          groupCount: groupCounts.get(experimentId) ?? 0,
        }

        META_COLUMNS.forEach((key) => {
          tableRow[key] = summarizeMetaValues(columns.get(key), key)
        })

        return tableRow
      })
    },
    // Rows for the current photoperiod. Every animal appears once per
    // photoperiod, so plotting without this filter draws each animal three
    // times.
    photoperiodRows() {
      return filterByPhotoperiod(this.store.community.summaryRows, this.photoperiod)
    },
    selectedRows() {
      const chosen = new Set([...this.selectedExperiments, ...this.highlightedExperiments])

      if (!chosen.size) {
        return []
      }

      return this.photoperiodRows.filter((row) => chosen.has(row.experiment_id))
    },
    numericAvailability() {
      return computeNumericAvailability(this.selectedRows)
    },
    numericVarOptions() {
      const hasSelection = this.selectedRows.length > 0

      return NUMERIC_VARS.map(({ key, label }) => ({
        key,
        label,
        available: !hasSelection || this.numericAvailability.has(key),
      }))
    },
    categoricalVarOptions() {
      const rows = this.selectedRows
      const hasSelection = rows.length > 0

      return CATEGORICAL_VARS.map(({ key, label }) => ({
        key,
        label,
        available: !hasSelection || rows.some((row) => !isMissingValue(row[key])),
      }))
    },
    // The full set of plot settings a preset controls, normalized so that
    // settings with no effect in the current mode cannot cause a false mismatch.
    plotConfig() {
      const isNumericColor = NUMERIC_KEYS.has(this.groupVar)

      return {
        photoperiod: this.photoperiod,
        xVar: this.xVar,
        yVar: this.yVar,
        colorBy: this.groupVar,
        numericColorMode: isNumericColor ? this.numericColorMode : DEFAULT_NUMERIC_COLOR_MODE,
        facetBy: this.facetBy,
        fitType: this.fitType,
        fitScope: this.fitType === 'none' ? 'group' : this.effectiveFitScope,
        showEquations: this.fitType === 'linear' ? this.showEquations : false,
      }
    },
    // Derived rather than stored, so the highlighted preset always reflects the
    // real state and silently stops matching once anything is changed by hand.
    activePresetId() {
      const current = this.plotConfig
      const match = COMMUNITY_PRESETS.find((preset) => {
        const target = this.normalizePresetConfig(preset.config)
        return Object.keys(target).every((key) => target[key] === current[key])
      })

      return match?.id ?? null
    },
    variableAvailability() {
      const availability = new Map()

      this.numericVarOptions.forEach((option) => availability.set(option.key, option.available))
      this.categoricalVarOptions.forEach((option) => availability.set(option.key, option.available))

      return availability
    },
    presetCards() {
      return COMMUNITY_PRESETS.map((preset) => {
        const missing = (preset.requires || []).filter(
          (key) => this.variableAvailability.get(key) === false,
        )

        // A preset that facets needs enough panels to be worth splitting, and
        // few enough to stay readable.
        if (
          preset.facetRequirement &&
          !this.facetVarOptions.some(
            (option) => option.key === preset.facetRequirement && option.available,
          ) &&
          !missing.includes(preset.facetRequirement)
        ) {
          missing.push(preset.facetRequirement)
        }

        return {
          ...preset,
          available: this.hasSelection && !missing.length,
          missingLabels: missing.map(labelFor),
        }
      })
    },
    activePlotFilterCount() {
      return this.plotFilterChips.length
    },
    // Numeric variables filter by range, categorical by value. Ranges are
    // derived from the current selection, so the slider spans real data.
    plotFilterRanges() {
      const ranges = new Map()

      NUMERIC_VARS.forEach(({ key }) => {
        const range = computeNumericRange(this.selectedRows, key)

        if (range) {
          ranges.set(key, range)
        }
      })

      return ranges
    },
    plotFilterFields() {
      const numericFields = NUMERIC_VARS.filter(({ key }) => this.plotFilterRanges.has(key)).map(
        ({ key, label }) => {
          const range = this.plotFilterRanges.get(key)

          return { key, label, filterKind: 'numberRange', range, step: range.step }
        },
      )

      const categoricalFields = CATEGORICAL_VARS.map(({ key, label }) => {
        const counts = new Map()

        this.selectedRows.forEach((row) => {
          const value = row[key]

          if (isMissingValue(value)) {
            return
          }

          const display = `${value}`.trim()
          counts.set(display, (counts.get(display) || 0) + 1)
        })

        return {
          key,
          label,
          filterKind: 'categorical',
          options: [...counts.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([value, count]) => ({ value, label: value, count })),
        }
      }).filter((field) => field.options.length > 1)

      return [...numericFields, ...categoricalFields]
    },
    plotFilterChips() {
      const chips = []

      NUMERIC_VARS.forEach(({ key, label }) => {
        const filter = this.plotFilters[key]
        const range = this.plotFilterRanges.get(key)

        if (!range || !filter) {
          return
        }

        const min = Number.isFinite(filter.min) ? filter.min : range.min
        const max = Number.isFinite(filter.max) ? filter.max : range.max

        // Only a narrowed range counts as an active filter.
        if (min <= range.min && max >= range.max) {
          return
        }

        chips.push({
          key,
          label,
          summary: `${formatFilterNumber(min, range.step)}–${formatFilterNumber(max, range.step)}`,
        })
      })

      CATEGORICAL_VARS.forEach(({ key, label }) => {
        const values = this.plotFilters[key]?.selectedValues

        if (!values?.length) {
          return
        }

        chips.push({
          key,
          label,
          summary: values.length > 3 ? `${values.length} selected` : values.join(', '),
        })
      })

      return chips
    },
    // Rows kept by the plot filters. Excluded rows are not discarded — they are
    // handed to the renderer as greyed-out context.
    plotFilterPredicate() {
      const activeKeys = this.plotFilterChips.map((chip) => chip.key)

      if (!activeKeys.length) {
        return () => true
      }

      const numeric = []
      const categorical = []

      activeKeys.forEach((key) => {
        const filter = this.plotFilters[key]

        if (NUMERIC_KEYS.has(key)) {
          const range = this.plotFilterRanges.get(key)
          numeric.push({
            key,
            min: Number.isFinite(filter.min) ? filter.min : range.min,
            max: Number.isFinite(filter.max) ? filter.max : range.max,
          })
          return
        }

        categorical.push({ key, values: filter.selectedValues })
      })

      return (row) => {
        for (let index = 0; index < numeric.length; index += 1) {
          const { key, min, max } = numeric[index]
          const value = toFiniteNumber(row[key])

          // A row with no value for a filtered measurement cannot satisfy it.
          if (value === null || value < min || value > max) {
            return false
          }
        }

        for (let index = 0; index < categorical.length; index += 1) {
          const { key, values } = categorical[index]

          if (!values.includes(`${row[key] ?? ''}`.trim())) {
            return false
          }
        }

        return true
      }
    },
    keptRows() {
      return this.selectedRows.filter(this.plotFilterPredicate)
    },
    facetVarOptions() {
      return CATEGORICAL_VARS.map(({ key, label }) => {
        // Counted exactly as facetLevels builds them, including the bucket for
        // missing values — otherwise a column with 12 real values plus blanks
        // reports 12 here and then renders 13 panels.
        const values = new Set(this.facetValuesFor(key))

        if (values.size > MAX_FACET_LEVELS) {
          return { key, label, available: false, reason: `${values.size} panels` }
        }

        if (values.size < 2) {
          return { key, label, available: false, reason: 'one value' }
        }

        return { key, label, available: true, reason: '' }
      })
    },
    // Panels come from the rows that survived filtering, so a filtered-away
    // level gets no panel at all.
    facetLevels() {
      if (!this.facetBy) {
        return []
      }

      return [...new Set(this.facetValuesFor(this.facetBy))].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      )
    },
    plotFilterPopoverStyle() {
      return {
        top: `${this.plotFilterPopoverPosition.top}px`,
        left: `${this.plotFilterPopoverPosition.left}px`,
      }
    },
    presetTooltipStyle() {
      return {
        top: `${this.presetTooltipPosition.top}px`,
        left: `${this.presetTooltipPosition.left}px`,
      }
    },
    isNumericColor() {
      return NUMERIC_VARS.some((variable) => variable.key === this.groupVar)
    },
    isGradientColor() {
      return this.isNumericColor && this.numericColorMode === 'gradient'
    },
    // A continuous color axis has no discrete groups to fit separately.
    effectiveFitScope() {
      return this.isGradientColor ? 'overall' : this.fitScope
    },
    // Bins, level order, and colors are derived once over the whole selection
    // so that Group A, Group B, and the two side-by-side panels all agree on
    // what each color means.
    colorBins() {
      if (!this.isNumericColor || this.isGradientColor) {
        return null
      }

      // Filtered-out points render grey, so they must not pull the bin
      // boundaries or the gradient extent around.
      return buildNumericBins(
        this.keptRows.map((row) => row[this.groupVar]),
        this.numericColorMode,
      )
    },
    colorDomain() {
      if (this.isGradientColor) {
        return []
      }

      if (this.colorBins) {
        return this.colorBins.labels
      }

      const values = new Set()

      this.keptRows.forEach((row) => {
        values.add(`${row[this.groupVar] ?? ''}`.trim() || 'Unknown')
      })

      return [...values].sort((left, right) => left.localeCompare(right))
    },
    seriesColors() {
      return buildSeriesColors(this.colorDomain, { ordered: this.isNumericColor })
    },
    colorExtent() {
      if (!this.isGradientColor) {
        return null
      }

      let min = Infinity
      let max = -Infinity

      this.keptRows.forEach((row) => {
        const value = toFiniteNumber(row[this.groupVar])

        if (value === null) {
          return
        }

        min = Math.min(min, value)
        max = Math.max(max, value)
      })

      return Number.isFinite(min) ? { min, max } : null
    },
    // A variable already in use can lose its data when the dataset selection
    // changes, so the guard covers the colour axis too, not just X and Y.
    unavailableSelectedVariables() {
      const inUse = new Set([this.xVar, this.yVar, this.groupVar])

      return [...this.numericVarOptions, ...this.categoricalVarOptions].filter(
        (variable) => inUse.has(variable.key) && !variable.available,
      )
    },
    // A row only becomes a marker if it has both plotted variables, and — when
    // color drives the series — a usable color value too. This mirrors what the
    // renderer keeps, so the counts below match what is actually on screen.
    hasPlottableCoordinates() {
      return (row) =>
        toFiniteNumber(row[this.xVar]) !== null && toFiniteNumber(row[this.yVar]) !== null
    },
    plottedRows() {
      return this.keptRows.filter((row) => {
        if (!this.hasPlottableCoordinates(row)) {
          return false
        }

        if (this.isGradientColor) {
          return toFiniteNumber(row[this.groupVar]) !== null
        }

        if (this.colorBins) {
          return this.colorBins.labelFor(row[this.groupVar]) !== null
        }

        return true
      })
    },
    // Filtered-out rows still need plottable coordinates to appear as ghosts.
    ghostRows() {
      const kept = new Set(this.keptRows)

      return this.selectedRows.filter((row) => !kept.has(row) && this.hasPlottableCoordinates(row))
    },
    // Points can outnumber animals: an animal recorded in several sessions
    // contributes one point per session.
    selectionStats() {
      const animals = new Set()

      this.plottedRows.forEach((row) => animals.add(animalKey(row)))

      return {
        animals: animals.size,
        points: this.plottedRows.length,
        filtered: this.ghostRows.length,
        incomplete: this.selectedRows.length - this.plottedRows.length - this.ghostRows.length,
      }
    },
    filterFields() {
      return FILTER_KEYS.map((key) => {
        const counts = {}
        this.experimentTableRows.forEach((row) => {
          const val = row[key]
          if (val) counts[val] = (counts[val] || 0) + 1
        })
        return {
          key,
          label: labelFor(key),
          filterKind: 'categorical',
          options: Object.entries(counts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([value, count]) => ({ value, label: value, count })),
        }
      })
    },
    groupAActiveFilterCount() {
      return Object.values(this.groupAFilters).filter((f) => f?.selectedValues?.length > 0).length
    },
    groupBActiveFilterCount() {
      return Object.values(this.groupBFilters).filter((f) => f?.selectedValues?.length > 0).length
    },
    filteredGroupAItems() {
      return this.searchRows(this.applyFilters(this.experimentTableRows, this.groupAFilters), this.groupASearch)
    },
    filteredGroupBItems() {
      return this.searchRows(this.applyFilters(this.experimentTableRows, this.groupBFilters), this.groupBSearch)
    },
    hasSelection() {
      return this.selectedExperiments.length > 0 || this.highlightedExperiments.length > 0
    },
    hasBothGroups() {
      return this.selectedExperiments.length > 0 && this.highlightedExperiments.length > 0
    },
    groupAFilterPopoverStyle() {
      return {
        top: `${this.groupAFilterPopoverPosition.top}px`,
        left: `${this.groupAFilterPopoverPosition.left}px`,
      }
    },
    groupBFilterPopoverStyle() {
      return {
        top: `${this.groupBFilterPopoverPosition.top}px`,
        left: `${this.groupBFilterPopoverPosition.left}px`,
      }
    },
  },
  watch: {
    selectedExperiments() { this.renderPlot() },
    highlightedExperiments() { this.renderPlot() },
    xVar() { this.renderPlot() },
    yVar() { this.renderPlot() },
    groupVar() { this.renderPlot() },
    photoperiod() { this.renderPlot() },
    numericColorMode() { this.renderPlot() },
    fitType() { this.renderPlot() },
    fitScope() { this.renderPlot() },
    showEquations() { this.renderPlot() },
    facetBy() { this.renderPlot() },
    showGhosts() { this.renderPlot() },
    plotFilters: { deep: true, handler() { this.renderPlot() } },
    // A facet level can disappear when filters or the dataset selection change.
    facetVarOptions(options) {
      if (!this.facetBy) {
        return
      }

      if (!options.some((option) => option.key === this.facetBy && option.available)) {
        this.facetBy = ''
      }
    },
    groupASearch() { this.showGroupAFilters = false },
    groupBSearch() { this.showGroupBFilters = false },
    filteredGroupAItems() { this.scheduleOverflowChecks() },
    filteredGroupBItems() { this.scheduleOverflowChecks() },
    plotMode() { this.renderPlot() },
    hasBothGroups(val) {
      if (!val) this.plotMode = 'overlay'
    },
  },
  async mounted() {
    document.addEventListener('click', this.handleDocumentClick)
    window.addEventListener('scroll', this.handleWindowScroll, true)
    window.addEventListener('resize', this.handleWindowResize)

    await this.loadCommunitySummaryRows()

    this.selectedExperiments = this.experimentTableRows.slice(0, 1).map((r) => r.experiment_id)
    this.scheduleOverflowChecks()
    this.renderPlot()
  },
  async beforeUnmount() {
    document.removeEventListener('click', this.handleDocumentClick)
    window.removeEventListener('scroll', this.handleWindowScroll, true)
    window.removeEventListener('resize', this.handleWindowResize)
    await purgePlot(this.$refs.summaryPlot)
    await purgePlot(this.$refs.summaryPlotA)
    await purgePlot(this.$refs.summaryPlotB)
  },
  methods: {
    async loadCommunitySummaryRows() {
      if (this.store.community.summaryLoaded) {
        return
      }

      const response = await fetch(summaryCsvUrl)
      const csv = await response.text()
      this.store.community.summaryRows = normalizeCommunityRows(preprocessSummary(parseCsv(csv)))
      this.store.community.summaryLoaded = true
    },
    handleDocumentClick(event) {
      if (this.showGroupAFilters) {
        const groupAPopover = this.$refs.groupAFilterPopover
        const groupAButton = this.$refs.groupAFilterButton
        if (!groupAPopover?.contains(event.target) && !groupAButton?.contains(event.target)) {
          this.showGroupAFilters = false
        }
      }

      if (this.showGroupBFilters) {
        const groupBPopover = this.$refs.groupBFilterPopover
        const groupBButton = this.$refs.groupBFilterButton
        if (!groupBPopover?.contains(event.target) && !groupBButton?.contains(event.target)) {
          this.showGroupBFilters = false
        }
      }

      if (this.showPlotFilters) {
        const plotPopover = this.$refs.plotFilterPopover
        const plotButton = this.$refs.plotFilterButton
        if (!plotPopover?.contains(event.target) && !plotButton?.contains(event.target)) {
          this.showPlotFilters = false
        }
      }
    },
    handleWindowResize() {
      this.scheduleGroupAFilterPopoverPosition()
      this.scheduleGroupBFilterPopoverPosition()
      this.schedulePlotFilterPopoverPosition()
    },
    handleWindowScroll() {
      this.scheduleGroupAFilterPopoverPosition()
      this.scheduleGroupBFilterPopoverPosition()
      this.schedulePlotFilterPopoverPosition()
      // The anchor rect is viewport-relative, so it goes stale as soon as the
      // page moves under it.
      this.hidePresetTooltip()
    },
    scheduleGroupAFilterPopoverPosition() {
      if (!this.showGroupAFilters) {
        return
      }

      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.updateFilterPopoverPosition('A')
        })
      })
    },
    scheduleGroupBFilterPopoverPosition() {
      if (!this.showGroupBFilters) {
        return
      }

      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.updateFilterPopoverPosition('B')
        })
      })
    },
    updateFilterPopoverPosition(groupKey) {
      const buttons = {
        A: this.$refs.groupAFilterButton,
        B: this.$refs.groupBFilterButton,
        plot: this.$refs.plotFilterButton,
      }
      const popovers = {
        A: this.$refs.groupAFilterPopover,
        B: this.$refs.groupBFilterPopover,
        plot: this.$refs.plotFilterPopover,
      }
      const button = buttons[groupKey]
      const popover = popovers[groupKey]

      if (!button || !popover) {
        return
      }

      const buttonRect = button.getBoundingClientRect()
      const popoverRect = popover.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const horizontalMargin = 16
      const verticalGap = 8

      let left = buttonRect.left
      if (left + popoverRect.width > viewportWidth - horizontalMargin) {
        left = viewportWidth - popoverRect.width - horizontalMargin
      }
      left = Math.max(horizontalMargin, left)

      let top = buttonRect.bottom + verticalGap
      const maxTop = viewportHeight - popoverRect.height - horizontalMargin
      if (top > maxTop) {
        top = Math.max(horizontalMargin, buttonRect.top - popoverRect.height - verticalGap)
      }

      if (groupKey === 'A') {
        this.groupAFilterPopoverPosition = { top, left }
        return
      }

      if (groupKey === 'plot') {
        this.plotFilterPopoverPosition = { top, left }
        return
      }

      this.groupBFilterPopoverPosition = { top, left }
    },
    toggleGroupAFilters() {
      this.showGroupAFilters = !this.showGroupAFilters
      if (this.showGroupAFilters) {
        this.showGroupBFilters = false
        this.scheduleGroupAFilterPopoverPosition()
      }
    },
    toggleGroupBFilters() {
      this.showGroupBFilters = !this.showGroupBFilters
      if (this.showGroupBFilters) {
        this.showGroupAFilters = false
        this.scheduleGroupBFilterPopoverPosition()
      }
    },
    updateGroupAOverflow() {
      const shell = this.$refs.groupATableScroll
      const table = shell?.querySelector('table')
      this.groupATableOverflowing = shell && table ? table.getBoundingClientRect().width - shell.clientWidth > 1 : false
    },
    updateGroupBOverflow() {
      const shell = this.$refs.groupBTableScroll
      const table = shell?.querySelector('table')
      this.groupBTableOverflowing = shell && table ? table.getBoundingClientRect().width - shell.clientWidth > 1 : false
    },
    scheduleOverflowChecks() {
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.updateGroupAOverflow()
          this.updateGroupBOverflow()
        })
      })
    },
    applyFilters(rows, filters) {
      return rows.filter((row) =>
        Object.entries(filters).every(([key, filter]) => {
          const selected = filter?.selectedValues
          return !selected?.length || selected.includes(row[key])
        }),
      )
    },
    searchRows(rows, search) {
      const q = search.trim().toLowerCase()
      if (!q) return rows
      return rows.filter((row) =>
        Object.values(row).some((v) => String(v).toLowerCase().includes(q)),
      )
    },
    toggleGroupA(id) {
      if (this.highlightedExperiments.includes(id)) return
      if (this.selectedExperiments.includes(id)) {
        this.selectedExperiments = this.selectedExperiments.filter((e) => e !== id)
      } else {
        this.selectedExperiments = [...this.selectedExperiments, id]
      }
    },
    toggleGroupB(id) {
      if (this.selectedExperiments.includes(id)) return
      if (this.highlightedExperiments.includes(id)) {
        this.highlightedExperiments = this.highlightedExperiments.filter((e) => e !== id)
      } else {
        this.highlightedExperiments = [...this.highlightedExperiments, id]
      }
    },
    selectAllGroupA() {
      const toAdd = this.filteredGroupAItems
        .map((r) => r.experiment_id)
        .filter((id) => !this.highlightedExperiments.includes(id))
      this.selectedExperiments = [...new Set([...this.selectedExperiments, ...toAdd])]
    },
    selectAllGroupB() {
      const toAdd = this.filteredGroupBItems
        .map((r) => r.experiment_id)
        .filter((id) => !this.selectedExperiments.includes(id))
      this.highlightedExperiments = [...new Set([...this.highlightedExperiments, ...toAdd])]
    },
    toggleGroupAFilter({ key, value }) {
      const filter = this.groupAFilters[key]
      const idx = filter.selectedValues.indexOf(value)
      if (idx >= 0) {
        this.groupAFilters[key] = { selectedValues: filter.selectedValues.filter((v) => v !== value) }
      } else {
        this.groupAFilters[key] = { selectedValues: [...filter.selectedValues, value] }
      }
    },
    toggleGroupBFilter({ key, value }) {
      const filter = this.groupBFilters[key]
      const idx = filter.selectedValues.indexOf(value)
      if (idx >= 0) {
        this.groupBFilters[key] = { selectedValues: filter.selectedValues.filter((v) => v !== value) }
      } else {
        this.groupBFilters[key] = { selectedValues: [...filter.selectedValues, value] }
      }
    },
    // The single definition of a column's facet levels, so the availability
    // guard and the rendered panels can never disagree.
    facetValuesFor(key) {
      return this.keptRows.map((row) =>
        isMissingValue(row[key]) ? 'Unknown' : `${row[key]}`.trim(),
      )
    },
    showPresetTooltip(preset, event) {
      const rect = event.currentTarget?.getBoundingClientRect()

      if (!rect) {
        return
      }

      // Copy the values out: a DOMRect exposes its properties on the prototype,
      // which does not survive being stored in reactive data.
      this.presetTooltipAnchor = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      }
      this.presetTooltip = preset.description

      this.$nextTick(() => {
        requestAnimationFrame(() => this.positionPresetTooltip())
      })
    },
    hidePresetTooltip() {
      this.presetTooltip = ''
    },
    positionPresetTooltip() {
      const tooltip = this.$refs.presetTooltip
      const anchor = this.presetTooltipAnchor

      if (!tooltip || !anchor) {
        return
      }

      const { width, height } = tooltip.getBoundingClientRect()
      const margin = 12
      const gap = 8

      const left = Math.min(
        Math.max(margin, anchor.left + anchor.width / 2 - width / 2),
        Math.max(margin, window.innerWidth - width - margin),
      )

      // Prefer above the card, and fall back below when there is no room.
      const above = anchor.top - height - gap
      const top = above < margin ? anchor.bottom + gap : above

      this.presetTooltipPosition = { top, left }
    },
    // Presets are partial, so unspecified settings fall back to defaults rather
    // than inheriting whatever the previous preset left behind.
    normalizePresetConfig(config) {
      const isNumericColor = NUMERIC_KEYS.has(config.colorBy)
      const numericColorMode = isNumericColor
        ? config.numericColorMode ?? DEFAULT_NUMERIC_COLOR_MODE
        : DEFAULT_NUMERIC_COLOR_MODE
      // Mirrors the live normalization in plotConfig, including the way a
      // gradient color scale forces the fit scope, so a preset still matches
      // once applied.
      const forcesOverallFit = isNumericColor && numericColorMode === 'gradient'
      const fitType = config.fitType ?? 'linear'

      return {
        photoperiod: config.photoperiod ?? DEFAULT_PHOTOPERIOD,
        xVar: config.xVar,
        yVar: config.yVar,
        colorBy: config.colorBy,
        numericColorMode,
        facetBy: config.facetBy ?? '',
        fitType,
        fitScope:
          fitType === 'none' ? 'group' : forcesOverallFit ? 'overall' : config.fitScope ?? 'group',
        showEquations: fitType === 'linear' ? Boolean(config.showEquations) : false,
      }
    },
    applyPreset(preset) {
      const config = this.normalizePresetConfig(preset.config)

      this.photoperiod = config.photoperiod
      this.xVar = config.xVar
      this.yVar = config.yVar
      this.groupVar = config.colorBy
      this.numericColorMode = config.numericColorMode
      this.facetBy = config.facetBy
      this.fitType = config.fitType
      this.fitScope = config.fitScope
      this.showEquations = config.showEquations
    },
    clearPreset() {
      this.photoperiod = DEFAULT_PHOTOPERIOD
      this.xVar = 'body_mass_g'
      this.yVar = 'energy_expenditure_kcal_hr'
      this.groupVar = 'group'
      this.numericColorMode = DEFAULT_NUMERIC_COLOR_MODE
      this.facetBy = ''
      this.fitType = 'linear'
      this.fitScope = 'group'
      this.showEquations = false
    },
    togglePlotFilters() {
      this.showPlotFilters = !this.showPlotFilters

      if (this.showPlotFilters) {
        this.showGroupAFilters = false
        this.showGroupBFilters = false
        this.schedulePlotFilterPopoverPosition()
      }
    },
    schedulePlotFilterPopoverPosition() {
      if (!this.showPlotFilters) {
        return
      }

      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.updateFilterPopoverPosition('plot')
        })
      })
    },
    togglePlotFilter({ key, value }) {
      const selected = this.plotFilters[key]?.selectedValues || []

      this.plotFilters[key] = {
        selectedValues: selected.includes(value)
          ? selected.filter((entry) => entry !== value)
          : [...selected, value],
      }
    },
    updatePlotFilterRange({ key, min, max }) {
      this.plotFilters[key] = { min, max }
    },
    clearPlotFilter(key) {
      this.plotFilters[key] = NUMERIC_KEYS.has(key) ? {} : { selectedValues: [] }
    },
    clearAllPlotFilters() {
      this.plotFilters = emptyPlotFilters()
    },
    clearGroupAFilter(key) {
      this.groupAFilters[key] = { selectedValues: [] }
    },
    clearGroupBFilter(key) {
      this.groupBFilters[key] = { selectedValues: [] }
    },
    computeAxisRanges(rows) {
      const xVals = rows.map((r) => toFiniteNumber(r[this.xVar])).filter((v) => v !== null)
      const yVals = rows.map((r) => toFiniteNumber(r[this.yVar])).filter((v) => v !== null)
      if (!xVals.length || !yVals.length) return null
      const xMin = Math.min(...xVals)
      const xMax = Math.max(...xVals)
      const yMin = Math.min(...yVals)
      const yMax = Math.max(...yVals)
      const xPad = (xMax - xMin) * 0.05 || 1
      const yPad = (yMax - yMin) * 0.05 || 1
      return {
        xRange: [xMin - xPad, xMax + xPad],
        yRange: [yMin - yPad, yMax + yPad],
      }
    },
    setPlotMode(mode) {
      purgePlot(this.$refs.summaryPlot)
      purgePlot(this.$refs.summaryPlotA)
      purgePlot(this.$refs.summaryPlotB)
      this.plotMode = mode
    },
    // Applying a preset moves several settings at once, and each has a watcher.
    // Coalescing into one draw per tick keeps that to a single Plotly pass.
    renderPlot() {
      if (this.renderScheduled) {
        return
      }

      this.renderScheduled = true

      this.$nextTick(() => {
        this.renderScheduled = false
        this.drawPlot()
      })
    },
    drawPlot() {
      const rows = this.photoperiodRows
      const base = {
        xVar: this.xVar,
        yVar: this.yVar,
        colorBy: this.groupVar,
        bins: this.colorBins,
        isGradient: this.isGradientColor,
        seriesColors: this.seriesColors,
        colorDomain: this.colorDomain,
        colorExtent: this.colorExtent,
        fitType: this.fitType,
        fitScope: this.effectiveFitScope,
        showEquations: this.showEquations,
        facetBy: this.facetBy,
        facetLevels: this.facetLevels,
        passesFilters: this.plotFilterPredicate,
        showGhosts: this.showGhosts,
      }

      // Already inside a nextTick, so the refs reflect the current guards.
      if (this.plotMode === 'side-by-side') {
        const allIds = new Set([...this.selectedExperiments, ...this.highlightedExperiments])
        const allRows = rows.filter((r) => allIds.has(r.experiment_id))
        const axisRanges = this.computeAxisRanges(allRows)
        renderSummaryRegressionPlot(this.$refs.summaryPlotA, rows, {
          ...base,
          selectedExperiments: this.selectedExperiments,
          highlightedExperiments: [],
          axisRanges,
        })
        renderSummaryRegressionPlot(this.$refs.summaryPlotB, rows, {
          ...base,
          selectedExperiments: this.highlightedExperiments,
          highlightedExperiments: [],
          axisRanges,
        })
        return
      }

      renderSummaryRegressionPlot(this.$refs.summaryPlot, rows, {
        ...base,
        selectedExperiments: this.selectedExperiments,
        highlightedExperiments: this.highlightedExperiments,
      })
    },
  },
}
</script>
