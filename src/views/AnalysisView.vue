<template>
  <div class="page-column" style="gap:20px;">
    <section>
      <div class="row-between">
        <div class="card-tabs">
          <button class="card-tab-2" :class="{ active: datasetSourceTab === 'public' }" @click="selectDatasetTab('public')">
            Public Datasets ({{ publicDatasetCount }})
          </button>
          <button
            class="card-tab-2"
            :class="{ active: datasetSourceTab === 'private' }"
            @click="selectDatasetTab('private')"
          >
            Your Datasets ({{ privateDatasetCount }})
          </button>
        </div>
      </div>
      <div v-if="loadingPublicFiles" class="empty-state">
        <BSpinner small />
      </div>
      <div
        v-else-if="datasetSourceItemCount"
        ref="datasetTableScrollShell"
        class="table-scroll-shell"
        :class="{ 'table-scroll-shell--overflowing': datasetTableHasHorizontalOverflow }"
        @scroll="handleDatasetTableScroll"
      >
        <div class="dataset-table-toolbar">
          <div style="display:flex; gap:10px">
            <div v-if="showDatasetFilterButton" class="dataset-table-filter-wrap">
              <button
                ref="datasetFilterButton"
                class="btn btn-sm"
                :class="activeDatasetFilterCount ? 'btn-secondary' : 'btn-outline-secondary'"
                @click.stop="toggleDatasetFilters"
              >
                Filter<span v-if="activeDatasetFilterCount"> ({{ activeDatasetFilterCount }})</span>
              </button>
            </div>
            <div v-if="showDatasetSearch" class="dataset-table-search-wrap">
              <input
                v-model="currentDatasetSearch"
                type="text"
                class="form-control form-control-sm dataset-table-search-input"
                placeholder="Search datasets"
              />
            </div>
          </div>

          <button class="btn btn-sm btn-outline-secondary" @click="toggleDatasetTableFitMode">
            {{ currentDatasetTableFitMode === 'content' ? 'Fit Columns' : 'Fit Content' }}
          </button>
        </div>
        <BTable
          v-if="datasetTableItems.length"
          :items="paginatedDatasetTableItems"
          :fields="datasetTableFields"
          :table-class="datasetTableClass"
          small
          hover
          striped
          sticky-header
        >
          <template #cell(name)="slot">
            <span :title="slot.item.name || slot.item.title || slot.item.id || ''">
              <template v-for="(segment, index) in getHighlightedSegments(slot.item.name || slot.item.title || slot.item.id || '')" :key="`name-${index}`">
                <mark v-if="segment.match" class="dataset-table-search-highlight">{{ segment.text }}</mark>
                <template v-else>{{ segment.text }}</template>
              </template>
            </span>
          </template>
          <template #cell(description)="slot">
            <span :title="slot.item.description || ''">
              <template v-for="(segment, index) in getHighlightedSegments(slot.item.description || '')" :key="`description-${index}`">
                <mark v-if="segment.match" class="dataset-table-search-highlight">{{ segment.text }}</mark>
                <template v-else>{{ segment.text }}</template>
              </template>
            </span>
          </template>
          <template
            v-for="field in metadataTableFields"
            :key="field.key"
            #[`cell(${field.key})`]="slot"
          >
            <span :title="formatMetadataCell(slot.item, field.key)">
              <template v-for="(segment, index) in getHighlightedSegments(formatMetadataCell(slot.item, field.key))" :key="`${field.key}-${index}`">
                <mark v-if="segment.match" class="dataset-table-search-highlight">{{ segment.text }}</mark>
                <template v-else>{{ segment.text }}</template>
              </template>
            </span>
          </template>
          <template #cell(uploaded_at)="slot">
            <span :title="formatDate(slot.item.uploaded_at)">
              <template v-for="(segment, index) in getHighlightedSegments(formatDate(slot.item.uploaded_at))" :key="`uploaded-${index}`">
                <mark v-if="segment.match" class="dataset-table-search-highlight">{{ segment.text }}</mark>
                <template v-else>{{ segment.text }}</template>
              </template>
            </span>
          </template>
          <template #cell(actions)="slot">
            <div class="dataset-table__action-wrap">
              <BButton v-if="isSelectedDataset(slot.item)" size="sm" variant="success" disabled class="dataset-table__action-btn">
                Selected
              </BButton>
              <BBadge
                v-else-if="datasetSourceTab === 'private' && slot.item.statusLoading"
                variant="secondary"
                class="dataset-table__action-badge"
              >
                Checking...
              </BBadge>
              <BBadge
                v-else-if="datasetSourceTab === 'private' && !isExperimentReadyForAnalysis(slot.item.statusInfo)"
                :variant="slot.item.statusInfo?.variant || 'warning'"
                class="dataset-table__action-badge"
              >
                {{ slot.item.statusInfo?.label || 'Draft' }}
              </BBadge>
              <BButton
                v-else
                size="sm"
                variant="primary"
                class="dataset-table__action-btn"
                @click="datasetSourceTab === 'private' ? openPrivateExperiment(slot.item) : openPublicExperiment(slot.item)"
              >
                <template v-if="slot.item.loading">
                  <BSpinner small />
                  <span style="margin-left: 0.4rem;">{{ formatLoadingProgress(slot.item.loadingProgress) }}</span>
                </template>
                <span v-else>Open</span>
              </BButton>
            </div>
          </template>
        </BTable>
        <div v-else class="empty-state dataset-table-empty-state">
          No matching datasets found.
        </div>
        <div v-if="currentDatasetPageCount > 1" class="preview-pagination dataset-table-pagination">
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="currentDatasetPage <= 1"
            @click="currentDatasetPage = currentDatasetPage - 1"
          >
            Previous
          </button>
          <span class="muted-copy">Page {{ currentDatasetPage }} of {{ currentDatasetPageCount }}</span>
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="currentDatasetPage >= currentDatasetPageCount"
            @click="currentDatasetPage = currentDatasetPage + 1"
          >
            Next
          </button>
        </div>
      </div>
      <div v-else-if="datasetSourceTab === 'private' && !store.auth.token" class="empty-state panel">
        <div class="page-column" style="gap: 8px; text-align: center;">
          <div>To analyze your own data</div>
          <div>
            <RouterLink to="/account" class="btn btn-sm btn-primary">Create an account</RouterLink>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        {{ datasetSourceTab === 'private' ? 'No private datasets found.' : 'No public datasets found.' }}
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="showDatasetFilters"
        ref="datasetFilterPopover"
        class="dataset-table-filter-popover"
        :style="datasetFilterPopoverStyle"
      >
        <DatasetTableFilterPopover
          :fields="currentDatasetFilterFields"
          :filters="currentDatasetFilters"
          @clear-field="clearCurrentDatasetFilter"
          @toggle-categorical="toggleCurrentDatasetCategoricalFilter"
          @update-range="updateCurrentDatasetRangeFilter"
        />
      </div>
    </Teleport>

    <section class="panel panel--spaced">
      <div v-if="sharedRouteLoading" class="empty-state panel">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <BSpinner small />
          <span>{{ formatLoadingProgress(sharedRouteProgress) }}</span>
        </div>
      </div>
  
      <div v-if="sharedRouteError" class="panel warn-copy">
        {{ sharedRouteError }}
      </div>
  
      <div
        v-if="!sharedRouteLoading && !store.experiment.current && !(datasetSourceTab === 'private' && !store.auth.token)"
        class="empty-state panel"
      >
        Select a dataset to see analysis plots.
      </div>
  
      <template v-else-if="store.experiment.current">
        <div class="row-between" style="align-items: flex-start; gap: 16px;">
          <div>
            <div style="font-size: 1.05rem; font-weight: 600;">{{ store.experiment.current.name || store.experiment.current.id }}</div>
            <div v-if="store.experiment.current.description" class="muted-copy" style="margin-top: 2px;">{{ store.experiment.current.description }}</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
            <span
              v-if="isViewingSharedDataset"
              class="dataset-privacy-pill inline-tooltip"
              tabindex="0"
              data-tooltip="This is a private dataset being viewed through a share link."
            >
              Private
            </span>
            <button class="btn btn-sm btn-outline-secondary" @click="showMetadata = !showMetadata">
              {{ showMetadata ? 'Hide Metadata' : 'Show Metadata' }}
            </button>
          </div>
        </div>

        <section v-if="showMetadata" class="panel panel--spaced">
          <div class="metadata-columns metadata-columns--compact">
            <section v-for="section in metadataSections" :key="section.title" class="metadata-section-columns">
              <strong>{{ section.title }}</strong>
              <div v-for="field in section.fields" :key="field.key" class="control-stack">
                <span class="metadata-field-label">{{ field.label }}</span>
                <span>{{ getMetadataValue(store.experiment.current, field.key) || '—' }}</span>
              </div>
            </section>
          </div>
        </section>
  
        <AnalysisPlotsPanel
          default-view-mode="single"
          :analysis-data="analysisData"
          :session-metadata="sessionMetadata"
          :max-hour="maxHour"
          :group-colors="groupColors"
          :analysis-options="analysisOptions"
        />
      </template>
    </section>

  </div>
</template>

<script>
import { appStore } from '../store/appStore'
import {
  fetchEnrichedSession,
  fetchPublicFiles,
  fetchSessionConfig,
  fetchSessionFile,
  fetchSharedFile,
  fetchUserFiles,
} from '../services/registryService'
import { formatDate } from '../utils/format'
import { parseCsv } from '../utils/csv'
import { clearProcessCaches, mergeSessionCsvIntoPayload, normalizeSessionPayload } from '../utils/process'
import { normalizeEnrichedAnalysisData } from '../utils/prep-for-analysis'
import AnalysisPlotsPanel from '../components/AnalysisPlotsPanel.vue'
import DatasetTableFilterPopover from '../components/DatasetTableFilterPopover.vue'
import experimentMetadataConfig from '../config/experimentMetadata.json'

const experimentMetadataSections = experimentMetadataConfig.sections
const datasetTableBaseFields = experimentMetadataConfig.datasetTable.baseFields
const metadataTableFields = experimentMetadataSections
  .flatMap((section) => section.fields)
  .filter((field) => field.showInPublicDatasetTable !== false)
const publicDatasetFilterFieldDefinitions = [
  ...datasetTableBaseFields.filter((field) => field.filterable),
  ...experimentMetadataSections
    .flatMap((section) => section.fields)
    .filter((field) => field.filterable),
]
const privateDatasetFieldDefinitions = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'uploaded_at', label: 'Uploaded' },
  { key: 'actions', label: 'Actions' },
]

function buildDatasetTableField(field, extra = {}) {
  const isActionsField = field.key === 'actions'

  return {
    key: field.key,
    label: field.label,
    thClass: isActionsField ? 'dataset-table__actions-cell' : '',
    tdClass: isActionsField ? 'dataset-table__actions-cell' : '',
    ...extra,
  }
}

function moveActionsFieldToEnd(fields) {
  return [
    ...fields.filter((field) => field.key !== 'actions'),
    ...fields.filter((field) => field.key === 'actions'),
  ]
}

const publicDatasetFields = moveActionsFieldToEnd([
  ...datasetTableBaseFields
    .filter((field) => field.showInPublicDatasetTable)
    .map((field) => buildDatasetTableField(field)),
  ...metadataTableFields
    .filter((field) => !datasetTableBaseFields.some((baseField) => baseField.key === field.key))
    .map((field) => buildDatasetTableField(field)),
])
const privateDatasetFields = publicDatasetFields

function normalizeMetadataObject(value) {
  if (!value) return {}
  if (typeof value === 'string') {
    try { return normalizeMetadataObject(JSON.parse(value)) } catch { return {} }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value
  return {}
}

function getMetadataValue(source, key) {
  const meta = normalizeMetadataObject(
    source?.metadata ?? source?.submission_metadata ?? source?.metadata_json,
  )
  if (key === 'experiment_id') {
    return meta[key] ?? source?.[key] ?? source?.submission_id ?? source?.id ?? ''
  }
  return meta[key] ?? source?.[key] ?? ''
}

function getFilterDisplayValue(source, key) {
  const value = getMetadataValue(source, key)
  return value === null || value === undefined || value === '' ? '—' : `${value}`
}

function getFilterNumericValue(source, key) {
  const numeric = Number(getMetadataValue(source, key))
  return Number.isFinite(numeric) ? numeric : null
}

function buildCategoricalFilterOptions(items, field) {
  const counts = new Map()

  items.forEach((item) => {
    const value = getFilterDisplayValue(item, field.key)
    counts.set(value, (counts.get(value) || 0) + 1)
  })

  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({
      value,
      label: value,
      count,
    }))
}

function buildRangeFilterDefinition(items, field) {
  const values = items
    .map((item) => getFilterNumericValue(item, field.key))
    .filter((value) => value !== null)

  if (!values.length) {
    return {
      ...field,
      range: { min: 0, max: 0 },
      step: Number(field.step) || 1,
    }
  }

  return {
    ...field,
    range: {
      min: Math.min(...values),
      max: Math.max(...values),
    },
    step: Number(field.step) || 1,
  }
}

function buildSearchableDatasetStrings(item) {
  return [
    item?.name || item?.title || item?.id || '',
    item?.description || '',
    ...metadataTableFields.map((field) => getFilterDisplayValue(item, field.key)),
  ]
    .map((value) => `${value}`.trim())
    .filter(Boolean)
}

const numericalColumns = [
  'vo2', 'vco2', 'ee', 'ee.acc', 'rer', 'feed', 'feed.acc', 'drink', 'drink.acc',
  'xytot', 'xyamb', 'pedmeter', 'allmeter', 'wheel', 'wheel.acc', 'C13', 'enviro.temp',
  'subject.mass', 'body.temp', 'enviro.sound', 'exp.minute', 'enviro.light',
]

function hasConfiguredCycleRange(lightCycleStart, darkCycleStart) {
  const light = Number(lightCycleStart)
  const dark = Number(darkCycleStart)

  if (!Number.isFinite(light) || !Number.isFinite(dark)) {
    return false
  }

  return !(light === 0 && dark === 0)
}

function isSessionReadyForAnalysis(sessionPayload = {}) {
  const normalized = normalizeSessionPayload(sessionPayload)
  const groups = normalized.groups || []
  const subjects = normalized.subjects || []

  const groupsComplete = groups.length > 0 && groups.every((group, index) => (
    Boolean(`${group?.name || `Group ${index + 1}`}`.trim())
    && Boolean(group?.color)
    && group?.diet_kcal !== null
    && group?.diet_kcal !== undefined
    && group?.diet_kcal !== ''
    && Boolean(group?.diet_name?.trim())
  ))

  if (!groupsComplete || !subjects.length) {
    return false
  }

  const assignedGroups = new Set(
    subjects
      .map((subject) => Number(subject.groupIndex))
      .filter((index) => Number.isInteger(index) && index >= 0 && index < groups.length),
  )

  const subjectsComplete = groups.every((_, index) => assignedGroups.has(index))
  const rangesComplete = hasConfiguredCycleRange(normalized.light_cycle_start, normalized.dark_cycle_start)

  return subjectsComplete && rangesComplete
}

function buildExperimentStatus({ hasConvertedData, sessionPayload }) {
  if (!hasConvertedData) {
    return {
      key: 'incomplete',
      label: 'Incomplete',
      variant: 'secondary',
    }
  }

  if (isSessionReadyForAnalysis(sessionPayload)) {
    return {
      key: 'ready_analysis',
      label: 'Ready for Analysis',
      variant: 'primary',
    }
  }

  return {
    key: 'draft',
    label: 'Draft',
    variant: 'warning',
  }
}

export default {
  name: 'AnalysisView',
  components: { AnalysisPlotsPanel, DatasetTableFilterPopover },
  data() {
    return {
      store: appStore,
      datasetSourceTab: 'public',
      datasetTableHasHorizontalOverflow: false,
      datasetFilterPopoverPosition: {
        top: 0,
        left: 0,
      },
      publicDatasetSearch: '',
      privateDatasetSearch: '',
      publicDatasetTableFitMode: 'content',
      privateDatasetTableFitMode: 'content',
      publicDatasetPage: 1,
      privateDatasetPage: 1,
      datasetTablePageSize: 5,
      showDatasetFilters: false,
      loadingPublicFiles: false,
      publicDatasetFilters: {},
      privateDatasetFilters: {},
      sharedRouteLoading: false,
      sharedRouteProgress: null,
      sharedRouteError: '',
      sharedRouteRequestId: 0,
      groupColors: {},
      analysisOptions: {
        removeOutliers: true,
      },
      showMetadata: false,
      metadataSections: experimentMetadataSections,
      userFilesStatusRequestId: 0,
    }
  },
  computed: {
    metadataTableFields() {
      return metadataTableFields
    },
    currentDatasetSearch: {
      get() {
        return this.datasetSourceTab === 'private' ? this.privateDatasetSearch : this.publicDatasetSearch
      },
      set(value) {
        if (this.datasetSourceTab === 'private') {
          this.privateDatasetSearch = value
          return
        }

        this.publicDatasetSearch = value
      },
    },
    currentDatasetTableFitMode() {
      return this.datasetSourceTab === 'private' ? this.privateDatasetTableFitMode : this.publicDatasetTableFitMode
    },
    currentDatasetPage: {
      get() {
        return this.datasetSourceTab === 'private' ? this.privateDatasetPage : this.publicDatasetPage
      },
      set(value) {
        const safeValue = Math.max(1, Number(value) || 1)

        if (this.datasetSourceTab === 'private') {
          this.privateDatasetPage = safeValue
          return
        }

        this.publicDatasetPage = safeValue
      },
    },
    currentDatasetFilters() {
      return this.datasetSourceTab === 'private' ? this.privateDatasetFilters : this.publicDatasetFilters
    },
    showDatasetSearch() {
      return true
    },
    normalizedCurrentDatasetSearch() {
      return `${this.currentDatasetSearch || ''}`.trim().toLowerCase()
    },
    isCurrentDatasetSearchActive() {
      return this.normalizedCurrentDatasetSearch.length >= 2
    },
    showDatasetFilterButton() {
      return this.currentDatasetFilterFields.length > 0
    },
    publicDatasetFilterFields() {
      return publicDatasetFilterFieldDefinitions.map((field) => (
        field.filterKind === 'numberRange'
          ? buildRangeFilterDefinition(this.store.account.publicFiles, field)
          : {
            ...field,
            options: buildCategoricalFilterOptions(this.store.account.publicFiles, field),
          }
      ))
    },
    privateDatasetSourceItems() {
      return this.store.account.userFiles.filter((item) => (
        item.statusLoading || this.isExperimentReadyForAnalysis(item.statusInfo)
      ))
    },
    privateDatasetFilterFields() {
      return publicDatasetFilterFieldDefinitions.map((field) => (
        field.filterKind === 'numberRange'
          ? buildRangeFilterDefinition(this.privateDatasetSourceItems, field)
          : {
            ...field,
            options: buildCategoricalFilterOptions(this.privateDatasetSourceItems, field),
          }
      ))
    },
    currentDatasetFilterFields() {
      return this.datasetSourceTab === 'private' ? this.privateDatasetFilterFields : this.publicDatasetFilterFields
    },
    activeDatasetFilterCount() {
      return Object.values(this.currentDatasetFilters).filter((filter) => {
        if (Array.isArray(filter?.selectedValues)) {
          return filter.selectedValues.length > 0
        }

        return Number.isFinite(filter?.min) || Number.isFinite(filter?.max)
      }).length
    },
    datasetFilterPopoverStyle() {
      return {
        top: `${this.datasetFilterPopoverPosition.top}px`,
        left: `${this.datasetFilterPopoverPosition.left}px`,
      }
    },
    datasetTableClass() {
      return `dataset-table dataset-table--fit-${this.currentDatasetTableFitMode}`
    },
    datasetTableFields() {
      return this.datasetSourceTab === 'private' ? privateDatasetFields : publicDatasetFields
    },
    analysisData() {
      return this.store.experiment.analysisData || {
        rows: this.store.experiment.detailRows,
        session: {
          groupNames: [],
          dietNames: [],
          dietCal: [],
          colors: [],
          subjects: [],
          hour_range: [0, 24],
        },
      }
    },
    sessionMetadata() {
      return this.analysisData.session
    },
    maxHour() {
      let maxHour = null

      this.analysisData.rows.forEach((row) => {
        const hour = Number(row?.hour)

        if (!Number.isFinite(hour)) {
          return
        }

        maxHour = maxHour === null ? hour : Math.max(maxHour, hour)
      })

      return maxHour === null ? 24 : Math.ceil(maxHour)
    },
    metadata() {
      const rows = this.analysisData.rows || []
      return {
        experimentId: this.store.experiment.current?.name || this.store.experiment.current?.id || 'Current experiment',
        description: this.store.experiment.current?.description || '',
        subjects: new Set(rows.map((row) => row['subject.id'])).size,
      }
    },
    datasetTableItems() {
      if (this.datasetSourceTab === 'private') {
        return this.privateDatasetSourceItems.filter((item) => (
          this.matchesDatasetFilters(item, this.privateDatasetFilterFields, this.privateDatasetFilters)
          && this.matchesDatasetSearch(item, this.privateDatasetSearch)
        ))
      }

      return this.store.account.publicFiles.filter((item) => (
        this.matchesDatasetFilters(item, this.publicDatasetFilterFields, this.publicDatasetFilters)
        && this.matchesDatasetSearch(item, this.publicDatasetSearch)
      ))
    },
    currentDatasetPageCount() {
      return Math.max(1, Math.ceil(this.datasetTableItems.length / this.datasetTablePageSize))
    },
    paginatedDatasetTableItems() {
      const start = (this.currentDatasetPage - 1) * this.datasetTablePageSize
      return this.datasetTableItems.slice(start, start + this.datasetTablePageSize)
    },
    publicDatasetCount() {
      return this.store.account.publicFiles.length
    },
    privateDatasetCount() {
      return this.privateDatasetSourceItems.length
    },
    datasetSourceItemCount() {
      return this.datasetSourceTab === 'private'
        ? this.privateDatasetSourceItems.length
        : this.store.account.publicFiles.length
    },
    isViewingSharedDataset() {
      return Boolean(this.store.experiment.current?.shared && this.$route.query.share)
    },
  },
  watch: {
    'store.experiment.current': {
      deep: true,
      handler() {
        this.syncDatasetSourceTab()
        this.scheduleDatasetTableMetricsUpdate()
      },
    },
    datasetSourceTab() {
      this.scheduleDatasetTableMetricsUpdate()
      if (this.showDatasetFilters) {
        this.scheduleDatasetFilterPopoverPosition()
      }
    },
    datasetTableItems() {
      if (this.currentDatasetPage > this.currentDatasetPageCount) {
        this.currentDatasetPage = this.currentDatasetPageCount
      }

      this.scheduleDatasetTableMetricsUpdate()
      if (this.showDatasetFilters) {
        this.scheduleDatasetFilterPopoverPosition()
      }
    },
    publicDatasetFilters: {
      deep: true,
      handler() {
        this.publicDatasetPage = 1
        this.scheduleDatasetTableMetricsUpdate()
      },
    },
    privateDatasetFilters: {
      deep: true,
      handler() {
        this.privateDatasetPage = 1
        this.scheduleDatasetTableMetricsUpdate()
      },
    },
    publicDatasetSearch() {
      this.publicDatasetPage = 1
      this.scheduleDatasetTableMetricsUpdate()
    },
    privateDatasetSearch() {
      this.privateDatasetPage = 1
      this.scheduleDatasetTableMetricsUpdate()
    },
    publicDatasetTableFitMode() {
      this.scheduleDatasetTableMetricsUpdate()
      if (this.showDatasetFilters) {
        this.scheduleDatasetFilterPopoverPosition()
      }
    },
    privateDatasetTableFitMode() {
      this.scheduleDatasetTableMetricsUpdate()
      if (this.showDatasetFilters) {
        this.scheduleDatasetFilterPopoverPosition()
      }
    },
    '$route.query.share': {
      async handler() {
        await this.handleSharedRoute()
      },
    },
  },
  async mounted() {
    this.syncDatasetSourceTab()

    if (!this.store.account.publicFiles.length) {
      this.loadingPublicFiles = true
      try {
        const files = await fetchPublicFiles()
        this.store.account.publicFiles = files.map((file) => ({ ...file, loading: false, loadingProgress: null }))
      } finally {
        this.loadingPublicFiles = false
        this.scheduleDatasetTableMetricsUpdate()
      }
    }

    if (this.store.auth.token && !this.store.account.userFiles.length) {
      await this.loadPrivateFiles()
    }

    this.scheduleDatasetTableMetricsUpdate()

    document.addEventListener('click', this.handleDocumentClick)
    window.addEventListener('scroll', this.handleWindowScroll, true)
    window.addEventListener('resize', this.handleWindowResize)

    const handledSharedRoute = await this.handleSharedRoute()

    if (!handledSharedRoute && this.store.experiment.current && this.store.experiment.analysisData?.rows?.length) {
      clearProcessCaches()
      this.initializeGroupColors(this.sessionMetadata)
    }
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleDocumentClick)
    window.removeEventListener('scroll', this.handleWindowScroll, true)
    window.removeEventListener('resize', this.handleWindowResize)
  },
  updated() {
    this.scheduleDatasetTableMetricsUpdate()
  },
  methods: {
    formatDate,
    getMetadataValue,
    handleDocumentClick(event) {
      if (!this.showDatasetFilters) {
        return
      }

      const popover = this.$refs.datasetFilterPopover

      if (popover?.contains(event.target)) {
        return
      }

      this.showDatasetFilters = false
    },
    handleWindowResize() {
      this.scheduleDatasetTableMetricsUpdate()
      this.scheduleDatasetFilterPopoverPosition()
    },
    handleWindowScroll() {
      this.scheduleDatasetFilterPopoverPosition()
    },
    scheduleDatasetFilterPopoverPosition() {
      if (!this.showDatasetFilters) {
        return
      }

      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.updateDatasetFilterPopoverPosition()
        })
      })
    },
    updateDatasetFilterPopoverPosition() {
      const button = this.$refs.datasetFilterButton
      const popover = this.$refs.datasetFilterPopover

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

      this.datasetFilterPopoverPosition = { top, left }
    },
    toggleDatasetFilters() {
      this.showDatasetFilters = !this.showDatasetFilters
      this.scheduleDatasetFilterPopoverPosition()
    },
    toggleDatasetTableFitMode() {
      if (this.datasetSourceTab === 'private') {
        this.privateDatasetTableFitMode = this.privateDatasetTableFitMode === 'content' ? 'columns' : 'content'
        return
      }

      this.publicDatasetTableFitMode = this.publicDatasetTableFitMode === 'content' ? 'columns' : 'content'
    },
    setDatasetTableFitMode(mode) {
      if (this.datasetSourceTab === 'private') {
        this.privateDatasetTableFitMode = mode
        return
      }

      this.publicDatasetTableFitMode = mode
    },
    handleDatasetTableScroll() {
      this.updateDatasetTableOverflowState()
      this.scheduleDatasetFilterPopoverPosition()
    },
    scheduleDatasetTableMetricsUpdate() {
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.updateDatasetTableOverflowState()
        })
      })
    },
    updateDatasetTableOverflowState() {
      const shell = this.$refs.datasetTableScrollShell
      const table = shell?.querySelector('table')

      if (!shell || !table) {
        this.datasetTableHasHorizontalOverflow = false
        return
      }

      this.datasetTableHasHorizontalOverflow = table.getBoundingClientRect().width - shell.clientWidth > 1
    },
    formatMetadataCell(source, key) {
      return getFilterDisplayValue(source, key)
    },
    matchesDatasetSearch(item, searchQuery) {
      const normalizedSearch = `${searchQuery || ''}`.trim().toLowerCase()

      if (normalizedSearch.length < 2) {
        return true
      }

      return buildSearchableDatasetStrings(item).some((value) => (
        value.toLowerCase().includes(normalizedSearch)
      ))
    },
    getHighlightedSegments(value) {
      const text = `${value ?? ''}`

      if (!this.isCurrentDatasetSearchActive) {
        return [{ text, match: false }]
      }

      const query = this.normalizedCurrentDatasetSearch
      const lowerText = text.toLowerCase()
      const segments = []
      let cursor = 0

      while (cursor < text.length) {
        const matchIndex = lowerText.indexOf(query, cursor)

        if (matchIndex === -1) {
          segments.push({ text: text.slice(cursor), match: false })
          break
        }

        if (matchIndex > cursor) {
          segments.push({ text: text.slice(cursor, matchIndex), match: false })
        }

        segments.push({
          text: text.slice(matchIndex, matchIndex + query.length),
          match: true,
        })
        cursor = matchIndex + query.length
      }

      return segments.length ? segments : [{ text, match: false }]
    },
    matchesDatasetFilters(item, filterFields, filters) {
      return filterFields.every((field) => {
        const activeFilter = filters[field.key]

        if (!activeFilter) {
          return true
        }

        if (field.filterKind === 'numberRange') {
          const value = getFilterNumericValue(item, field.key)

          if (value === null) {
            return false
          }

          return value >= activeFilter.min && value <= activeFilter.max
        }

        if (activeFilter.selectedValues?.length) {
          return activeFilter.selectedValues.includes(getFilterDisplayValue(item, field.key))
        }

        return true
      })
    },
    toggleCurrentDatasetCategoricalFilter({ key, value }) {
      const currentFilters = this.datasetSourceTab === 'private' ? this.privateDatasetFilters : this.publicDatasetFilters
      const current = currentFilters[key]?.selectedValues || []
      const nextValues = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]

      if (!nextValues.length) {
        this.clearCurrentDatasetFilter(key)
        return
      }

      const nextFilters = {
        ...currentFilters,
        [key]: { selectedValues: nextValues },
      }

      if (this.datasetSourceTab === 'private') {
        this.privateDatasetFilters = nextFilters
        return
      }

      this.publicDatasetFilters = nextFilters
    },
    updateCurrentDatasetRangeFilter({ key, min, max }) {
      const filterFields = this.currentDatasetFilterFields
      const currentFilters = this.datasetSourceTab === 'private' ? this.privateDatasetFilters : this.publicDatasetFilters
      const field = filterFields.find((entry) => entry.key === key)

      if (!field) {
        return
      }

      if (min <= field.range.min && max >= field.range.max) {
        this.clearCurrentDatasetFilter(key)
        return
      }

      const nextFilters = {
        ...currentFilters,
        [key]: { min, max },
      }

      if (this.datasetSourceTab === 'private') {
        this.privateDatasetFilters = nextFilters
        return
      }

      this.publicDatasetFilters = nextFilters
    },
    clearCurrentDatasetFilter(key) {
      const nextFilters = { ...(this.datasetSourceTab === 'private' ? this.privateDatasetFilters : this.publicDatasetFilters) }
      delete nextFilters[key]

      if (this.datasetSourceTab === 'private') {
        this.privateDatasetFilters = nextFilters
        return
      }

      this.publicDatasetFilters = nextFilters
    },
    buildExperimentStatusInfo(hasConvertedData, sessionPayload) {
      return buildExperimentStatus({
        hasConvertedData,
        sessionPayload,
      })
    },
    buildLoadingStatusInfo(hasConvertedData) {
      if (!hasConvertedData) {
        return this.buildExperimentStatusInfo(hasConvertedData, {})
      }

      return {
        key: 'loading',
        label: 'Checking...',
        variant: 'secondary',
      }
    },
    buildUserFileRecord(file) {
      const standard = file.files?.find((item) => item.file_type === 'standard')
      const session = file.files?.find((item) => item.file_type === 'session')
      const hasConvertedData = Boolean(standard)
      const hasSession = Boolean(session)

      return {
        ...file,
        loading: false,
        loadingProgress: null,
        statusLoading: hasSession,
        statusInfo: hasSession
          ? this.buildLoadingStatusInfo(hasConvertedData)
          : this.buildExperimentStatusInfo(hasConvertedData, {}),
      }
    },
    async hydratePrivateFileStatuses(requestId, files) {
      await Promise.allSettled(files.map(async (file) => {
        const session = file.files?.find((item) => item.file_type === 'session')

        if (!session) {
          return
        }

        let sessionPayload = {}

        try {
          const [sessionConfig, sessionCsv] = await Promise.all([
            fetchSessionConfig(session.id, this.store.auth.token),
            fetchSessionFile(session.id, this.store.auth.token),
          ])
          sessionPayload = mergeSessionCsvIntoPayload(parseCsv(sessionCsv), sessionConfig)
        } catch (error) {
          sessionPayload = {}
        }

        if (requestId !== this.userFilesStatusRequestId) {
          return
        }

        const targetFile = this.store.account.userFiles.find((item) => item.id === file.id)
        if (!targetFile) {
          return
        }

        targetFile.statusInfo = this.buildExperimentStatusInfo(
          Boolean(file.files?.find((item) => item.file_type === 'standard')),
          sessionPayload,
        )
        targetFile.statusLoading = false
      }))
    },
    isExperimentReadyForAnalysis(statusInfo) {
      return statusInfo?.key === 'ready_analysis' || statusInfo?.key === 'ready_public'
    },
    selectDatasetTab(tab) {
      this.datasetSourceTab = tab
    },
    syncDatasetSourceTab() {
      if (this.store.experiment.current?._datasetSourceTab) {
        this.datasetSourceTab = this.store.experiment.current._datasetSourceTab
        return
      }

      if (this.store.auth.token && this.store.experiment.current && !this.store.experiment.current.public) {
        this.datasetSourceTab = 'private'
        return
      }

      this.datasetSourceTab = 'public'
    },
    async loadPrivateFiles() {
      const requestId = this.userFilesStatusRequestId + 1
      this.userFilesStatusRequestId = requestId
      const files = await fetchUserFiles(this.store.auth.token)
      this.store.account.userFiles = files.map((file) => this.buildUserFileRecord(file))
      this.hydratePrivateFileStatuses(requestId, files)
    },
    clearCurrentAnalysis() {
      this.store.experiment.current = null
      this.store.experiment.detailRows = []
      this.store.experiment.analysisData = null
      this.store.experiment.analysisSessionId = null
      this.store.experiment.qcResults = null
      this.store.experiment.powerResults = null
      this.store.experiment.ancovaResults = null
      this.store.experiment.analysisErrors.qc = null
      this.store.experiment.analysisErrors.power = null
      this.store.experiment.analysisErrors.ancova = null
      this.groupColors = {}
    },
    async handleSharedRoute() {
      const shareId = `${this.$route.query.share || ''}`.trim()
      const requestId = this.sharedRouteRequestId + 1
      this.sharedRouteRequestId = requestId

      if (!shareId) {
        this.sharedRouteLoading = false
        this.sharedRouteProgress = null
        this.sharedRouteError = ''
        return false
      }

      if (this.store.experiment.current?.id === shareId && this.store.experiment.analysisData?.rows?.length) {
        this.sharedRouteLoading = false
        this.sharedRouteProgress = null
        this.sharedRouteError = ''
        this.store.experiment.current._datasetSourceTab = 'public'
        return true
      }

      this.sharedRouteLoading = true
      this.sharedRouteProgress = 0
      this.sharedRouteError = ''
      this.clearCurrentAnalysis()

      try {
        const sharedFile = await fetchSharedFile(shareId)
        if (requestId !== this.sharedRouteRequestId) {
          return true
        }

        const preparedFile = {
          ...sharedFile,
          id: sharedFile.id || sharedFile.submission_id || shareId,
          public: true,
          shared: true,
          loading: false,
          loadingProgress: null,
          _datasetSourceTab: 'public',
        }

        await this.openExperimentForAnalysis(preparedFile, true, {
          preserveShareQuery: true,
          sourceTab: 'public',
          shouldApplyResults: () => requestId === this.sharedRouteRequestId,
          onLoadingProgress: (progress) => {
            if (requestId === this.sharedRouteRequestId) {
              this.sharedRouteProgress = progress
            }
          },
        })
        return true
      } catch (error) {
        if (requestId === this.sharedRouteRequestId) {
          this.sharedRouteError = error.message || 'Unable to load shared dataset.'
        }
        return false
      } finally {
        if (requestId === this.sharedRouteRequestId) {
          this.sharedRouteLoading = false
          this.sharedRouteProgress = null
        }
      }
    },
    async openExperimentForAnalysis(
      file,
      isPublic,
      { preserveShareQuery = false, sourceTab = null, onLoadingProgress = null, shouldApplyResults = null } = {},
    ) {
      const session = file.files.find((item) => item.file_type === 'session')

      if (!session) {
        return
      }

      file.loading = true
      file.loadingProgress = 0
      if (typeof onLoadingProgress === 'function') {
        onLoadingProgress(0)
      }
      try {
        clearProcessCaches()
        const [enrichedPayload, sessionConfig] = await Promise.all([
          fetchEnrichedSession(session.id, this.store.auth.token, isPublic, {
            onProgress: (progress) => {
              const safeProgress = Number.isFinite(progress) ? progress : 0
              file.loadingProgress = Math.max(5, Math.min(95, Math.round(safeProgress * 0.9 + 5)))
              if (typeof onLoadingProgress === 'function') {
                onLoadingProgress(file.loadingProgress)
              }
            },
          }),
          fetchSessionConfig(session.id, this.store.auth.token, isPublic).then((result) => {
            file.loadingProgress = Math.max(Number(file.loadingProgress) || 0, 10)
            if (typeof onLoadingProgress === 'function') {
              onLoadingProgress(file.loadingProgress)
            }
            return result
          }),
        ])

        const analysisData = normalizeEnrichedAnalysisData(enrichedPayload, {
          numericalColumns,
          sessionConfig,
        })

        if (typeof shouldApplyResults === 'function' && !shouldApplyResults()) {
          return
        }

        this.store.experiment.current = file
        this.store.experiment.current._datasetSourceTab = sourceTab || (isPublic ? 'public' : 'private')
        this.store.experiment.detailRows = analysisData.rows
        this.store.experiment.analysisData = analysisData
        this.syncDatasetSourceTab()
        this.initializeGroupColors(this.sessionMetadata)
        file.loadingProgress = 100
        if (typeof onLoadingProgress === 'function') {
          onLoadingProgress(100)
        }
        if (!preserveShareQuery && this.$route.query.share) {
          await this.$router.replace('/analysis')
        }
      } finally {
        file.loading = false
        file.loadingProgress = null
      }
    },
    async openPublicExperiment(file) {
      await this.openExperimentForAnalysis(file, true, { sourceTab: 'public' })
    },
    async openPrivateExperiment(file) {
      await this.openExperimentForAnalysis(file, false, { sourceTab: 'private' })
    },
    formatLoadingProgress(progress) {
      const numericProgress = Number(progress)

      if (!Number.isFinite(numericProgress) || numericProgress <= 0) {
        return 'Loading...'
      }

      return `${Math.min(100, Math.round(numericProgress))}%`
    },
    initializeGroupColors(session) {
      const nextGroupColors = {}
      const fallbackPalette = ['#3B73C7', '#ED5F00', '#2E8B57', '#8B5CF6', '#B45309', '#D64550']

      session.groupNames.forEach((groupName, index) => {
        nextGroupColors[groupName] = session.colors[index] || fallbackPalette[index % fallbackPalette.length]
      })

      this.groupColors = nextGroupColors
    },
    isSelectedDataset(file) {
      return this.store.experiment.current?.id === file.id
    },
  },
}
</script>
