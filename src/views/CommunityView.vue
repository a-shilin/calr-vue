<template>
  <div class="page-column" style="gap:20px;">
    <div class="page-header">
      <p class="page-kicker">Community Repository</p>
      <h1 class="page-title">Compare Results</h1>
      <p class="page-subtitle">Select datasets from both Group A and Group B to compare their summary results.</p>
    </div>
    <section class="panel panel--spaced">
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

      <section class="plot-row plot-row--reverse">
        <aside class="controls-panel">
          <span class="panel-label">Variables</span>
          <label class="control-stack">
            X Variable
            <select v-model="xVar">
              <option v-for="variable in numericVars" :key="variable" :value="variable">{{ variable }}</option>
            </select>
          </label>
          <label class="control-stack">
            Y Variable
            <select v-model="yVar">
              <option v-for="variable in numericVars" :key="variable" :value="variable">{{ variable }}</option>
            </select>
          </label>
          <label class="control-stack">
            Group / Color By
            <select v-model="groupVar">
              <option v-for="variable in categoricalVars" :key="variable" :value="variable">{{ variable }}</option>
            </select>
          </label>
        </aside>

        <div class="panel plot-panel">
          <div class="community-plot-header">
            <div v-if="hasBothGroups" class="plots-view-toggle">
              <button class="view-toggle-btn" :class="{ active: plotMode === 'overlay' }" @click="setPlotMode('overlay')">Overlay</button>
              <button class="view-toggle-btn" :class="{ active: plotMode === 'side-by-side' }" @click="setPlotMode('side-by-side')">Side by Side</button>
            </div>
          </div>
          <template v-if="hasSelection">
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
          <div v-else class="d-flex align-items-center justify-content-center h-100 text-muted">
            Select at least one dataset to view the plot.
          </div>
        </div>
      </section>

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
    </section>
  </div>
</template>

<script>
import { appStore } from '../store/appStore'
import { parseCsv, preprocessSummary } from '../utils/csv'
import { purgePlot } from '../utils/plotting/core'
import { renderSummaryRegressionPlot } from '../utils/plotting/summary-regression'
import DatasetTableFilterPopover from '../components/DatasetTableFilterPopover.vue'

const summaryCsvUrl = `${import.meta.env.BASE_URL}02032026_combined_datasets_calrepo.csv`
const FILTER_KEYS = ['sex', 'system', 'strain', 'location']
const FILTER_LABELS = { sex: 'Sex', system: 'System', strain: 'Strain', location: 'Location' }

function emptyFilters() {
  return Object.fromEntries(FILTER_KEYS.map((k) => [k, { selectedValues: [] }]))
}

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
      numericVars: [
        'body_mass_g',
        'lean_mass_g',
        'fat_mass_g',
        'energy_expenditure_kcal_hr',
        'food_intake_kcal_hr',
        'water_intake_ml_hr',
        'vo2_ml_hr',
        'vco2_ml_hr',
        'rer',
        'locomotor_activity_beam_breaks_hr',
        'pedestrian_locomotion_m_hr',
        'body_temperature_c',
        'distance_in_cage_m_hr',
        'energy_balance_kcal_hr',
      ],
      categoricalVars: [
        'experiment_id',
        'subject_id',
        'species',
        'tissue',
        'group',
        'diet_name',
        'strain',
        'genetic_background',
        'sex',
        'system',
        'location',
        'treatment',
        'time_of_day',
        'investigator',
      ],
      xVar: 'body_mass_g',
      yVar: 'energy_expenditure_kcal_hr',
      groupVar: 'time_of_day',
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
        { key: 'groupCount', label: 'Groups' },
        { key: 'investigator', label: 'Investigator' },
        { key: 'system', label: 'System' },
        { key: 'location', label: 'Location' },
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
      const seen = new Map()
      const groupCounts = buildCommunityGroupCountMap(this.store.community.summaryRows)

      this.store.community.summaryRows.forEach((row) => {
        if (!seen.has(row.experiment_id)) {
          seen.set(row.experiment_id, {
            experiment_id: row.experiment_id,
            groupCount: groupCounts.get(`${row.experiment_id}`) ?? 0,
            investigator: row.investigator || '',
            system: row.system || '',
            location: row.location || '',
            sex: row.sex || '',
            strain: row.strain || '',
            genetic_background: row.genetic_background || '',
            species: row.species || '',
            age: row.age || '',
            diet_name: row.diet_name || '',
            diet_kcal_g: row.diet_kcal_g || '',
            treatment: row.treatment || '',
            ambient_temperature_c: row.ambient_temperature_c || '',
            litter: row.litter || '',
            bedding: row.bedding || '',
            ee_calculation_method: row.ee_calculation_method || '',
            enrichment: row.enrichment || '',
            experiment_duration_hr: row.experiment_duration_hr || '',
            pmid: row.pmid || '',
          })
        }
      })
      return [...seen.values()]
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
          label: FILTER_LABELS[key],
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
      this.store.community.summaryRows = preprocessSummary(parseCsv(csv))
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
    },
    handleWindowResize() {
      this.scheduleGroupAFilterPopoverPosition()
      this.scheduleGroupBFilterPopoverPosition()
    },
    handleWindowScroll() {
      this.scheduleGroupAFilterPopoverPosition()
      this.scheduleGroupBFilterPopoverPosition()
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
      const button = groupKey === 'A' ? this.$refs.groupAFilterButton : this.$refs.groupBFilterButton
      const popover = groupKey === 'A' ? this.$refs.groupAFilterPopover : this.$refs.groupBFilterPopover

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
    clearGroupAFilter(key) {
      this.groupAFilters[key] = { selectedValues: [] }
    },
    clearGroupBFilter(key) {
      this.groupBFilters[key] = { selectedValues: [] }
    },
    computeAxisRanges(rows) {
      const xVals = rows.map((r) => r[this.xVar]).filter((v) => Number.isFinite(v))
      const yVals = rows.map((r) => r[this.yVar]).filter((v) => Number.isFinite(v))
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
    renderPlot() {
      const rows = this.store.community.summaryRows
      const base = { xVar: this.xVar, yVar: this.yVar, groupVar: this.groupVar }

      this.$nextTick(() => {
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
        } else {
          renderSummaryRegressionPlot(this.$refs.summaryPlot, rows, {
            ...base,
            selectedExperiments: this.selectedExperiments,
            highlightedExperiments: this.highlightedExperiments,
          })
        }
      })
    },
  },
}
</script>
