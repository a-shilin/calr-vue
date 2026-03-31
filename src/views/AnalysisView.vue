<template>
  <div class="page-column">
    <section class="panel panel--spaced">
      <strong>Public Datasets</strong>
      <div v-if="loadingPublicFiles" class="empty-state">
        <BSpinner small />
      </div>
      <BTable v-else-if="store.account.publicFiles.length" :items="store.account.publicFiles" :fields="publicFields" small hover striped>
        <template #cell(name)="slot">
          {{ slot.item.name || slot.item.title || slot.item.id }}
        </template>
        <template #cell(description)="slot">
          {{ slot.item.description || '' }}
        </template>
        <template #cell(uploaded_at)="slot">
          {{ formatDate(slot.item.uploaded_at) }}
        </template>
        <template #cell(actions)="slot">
          <BBadge v-if="isSelectedDataset(slot.item)" variant="success">Selected</BBadge>
          <BButton v-else size="sm" variant="primary" @click="openPublicExperiment(slot.item)">
            <BSpinner v-if="slot.item.loading" small />
            <span v-else>Open</span>
          </BButton>
        </template>
      </BTable>
      <div v-else class="empty-state">No public datasets found.</div>
    </section>

    <div v-if="!store.experiment.current" class="empty-state panel">
      Select a dataset to see analysis plots.
    </div>

    <template v-else>
      <section class="panel panel--spaced">
        <strong>Dataset Info</strong>
        <div class="dataset-grid">
          <div>
            <div><strong>Experiment ID:</strong> {{ metadata.experimentId }}</div>
            <div><strong>Groups:</strong> {{ metadata.groups.join(', ') }}</div>
            <div><strong>Diets:</strong> {{ metadata.diets.join(', ') }}</div>
            <div><strong>Duration (hrs):</strong> {{ maxHour }}</div>
          </div>
          <div>
            <div><strong>Subjects:</strong> {{ metadata.subjects }}</div>
            <div><strong>Files:</strong> {{ store.experiment.current.files?.length || 0 }}</div>
            <div><strong>Diet Calories:</strong> {{ metadata.dietCalories.join(', ') }}</div>
          </div>
        </div>
        <div class="group-color-grid">
          <label v-for="group in metadata.groups" :key="group" class="group-color-field">
            <span>{{ group }}</span>
            <input v-model="groupColors[group]" type="color" />
          </label>
        </div>
      </section>

      <section class="plot-row">
        <aside class="controls-panel">
          <strong>Time-Series Options</strong>
          <label class="control-stack">
            Metabolic Variable
            <select v-model="timeOptions.yVar">
              <option v-for="variable in explorerVariables" :key="variable.field" :value="variable.field">
                {{ variable.label }}
              </option>
            </select>
          </label>

          <label class="checkbox-row">
            <input v-model="timeOptions.smoothing" type="checkbox" />
            Apply Smoothing
          </label>

          <label class="control-stack">
            Smoothing Window
            <input v-model.number="timeOptions.smoothWindow" type="range" min="1" max="50" />
            <span>{{ timeOptions.smoothWindow }}</span>
          </label>

          <label class="checkbox-row">
            <input v-model="timeOptions.showMean" type="checkbox" />
            Show Mean Trace
          </label>

          <label class="checkbox-row">
            <input v-model="timeOptions.showIndividuals" type="checkbox" />
            Show Individual Traces
          </label>

          <label class="checkbox-row">
            <input v-model="timeOptions.showDarkLight" type="checkbox" />
            Shade Dark/Light Periods
          </label>

          <label class="checkbox-row">
            <input v-model="timeOptions.removeOutliers" type="checkbox" />
            Remove outliers
          </label>

          <label class="control-stack">
            Plot Range
            <div class="range-row">
              <input v-model.number="timeOptions.rangeStart" type="number" :min="0" :max="maxHour" />
              <span>to</span>
              <input v-model.number="timeOptions.rangeEnd" type="number" :min="0" :max="maxHour" />
            </div>
          </label>
        </aside>

        <div class="panel plot-panel">
          <div ref="timePlot" class="plot-surface"></div>
        </div>
      </section>

      <section class="plot-row">
        <aside class="controls-panel">
          <strong>Distribution Options</strong>
          <label class="control-stack">
            Metabolic Variable
            <select v-model="distributionVariable">
              <option v-for="variable in explorerVariables" :key="variable.field" :value="variable.field">
                {{ variable.label }}
              </option>
            </select>
          </label>
        </aside>

        <div class="panel plot-panel">
          <div ref="distributionPlot" class="plot-surface"></div>
        </div>
      </section>

      <section class="plot-row">
        <aside class="controls-panel">
          <strong>Regression Options</strong>
          <label class="control-stack">
            Metabolic Variable
            <select v-model="regressionOptions.yVar">
              <option v-for="variable in regressionYVariables" :key="variable.field" :value="variable.field">
                {{ variable.label }}
              </option>
            </select>
          </label>

          <label class="control-stack">
            Covariate
            <select v-model="regressionOptions.xVar">
              <option v-for="variable in regressionXVariables" :key="variable.field" :value="variable.field">
                {{ variable.label }}
              </option>
            </select>
          </label>

          <label class="control-stack">
            Time of Day
            <select v-model="regressionOptions.period">
              <option value="Total">Total</option>
              <option value="Light">Light</option>
              <option value="Dark">Dark</option>
            </select>
          </label>

          <label class="checkbox-row">
            <input v-model="regressionOptions.showCI" type="checkbox" />
            Show 95% Confidence Interval
          </label>
        </aside>

        <div class="panel plot-panel">
          <div ref="regressionPlot" class="plot-surface"></div>
        </div>
      </section>

      <section class="plot-row">
        <aside class="controls-panel">
          <strong>Weight</strong>
          <div class="muted-copy">Group mean body mass with SEM.</div>
        </aside>
        <div class="panel plot-panel">
          <div ref="weightPlot" class="plot-surface"></div>
        </div>
      </section>

      <section class="plot-row">
        <aside class="controls-panel">
          <strong>QC</strong>
          <label class="control-stack">
            Number of mass measurements
            <input v-model.number="qcOptions.nMassMeasurements" type="number" min="1" max="15" step="1" />
          </label>

          <label class="control-stack">
            Hours
            <div class="range-row">
              <input v-model.number="qcOptions.hourStart" type="number" :min="0" :max="maxHour" />
              <span>to</span>
              <input v-model.number="qcOptions.hourEnd" type="number" :min="0" :max="maxHour" />
            </div>
          </label>

          <BButton size="sm" variant="outline-secondary" :disabled="store.loaders.doQC || !analysisDirty.qc" @click="runQc">
            <BSpinner v-if="store.loaders.doQC" small />
            <span v-else>Run QC</span>
          </BButton>
          <div v-if="analysisDirty.qc" class="muted-copy">Settings changed. Run QC to refresh this plot.</div>
          <div v-else class="muted-copy">QC is up to date for the current settings.</div>
        </aside>
        <div class="panel plot-panel">
          <div v-if="store.experiment.qcResults" ref="qcPlot" class="plot-surface"></div>
          <div v-else class="plot-placeholder">Run QC to populate this plot.</div>
        </div>
      </section>

      <section class="plot-row">
        <aside class="controls-panel">
          <strong>Power</strong>
          <label class="control-stack">
            Covariate
            <select v-model="powerOptions.variable">
              <option v-for="variable in powerVariableOptions" :key="variable.field" :value="variable.field">
                {{ variable.label }}
              </option>
            </select>
          </label>

          <label class="control-stack">
            Population Sizes
            <input v-model="powerOptions.sampleSizesText" type="text" />
          </label>

          <div class="muted-copy">
            Enter group sizes separated by commas. Modeled power assumes groups of equal size.
          </div>

          <label class="control-stack">
            Day Phase
            <select v-model="powerOptions.dayPhase">
              <option value="total">Full Day</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <label class="control-stack">
            Alpha Level
            <input v-model.number="powerOptions.alpha" type="number" min="0" max="1" step="0.05" />
          </label>

          <label class="control-stack">
            Hours
            <div class="range-row">
              <input v-model.number="powerOptions.hourStart" type="number" :min="0" :max="maxHour" />
              <span>to</span>
              <input v-model.number="powerOptions.hourEnd" type="number" :min="0" :max="maxHour" />
            </div>
          </label>

          <BButton size="sm" variant="outline-secondary" :disabled="store.loaders.doPower || !analysisDirty.power" @click="runPower">
            <BSpinner v-if="store.loaders.doPower" small />
            <span v-else>Run Power</span>
          </BButton>
          <div v-if="analysisDirty.power" class="muted-copy">Settings changed. Run Power to refresh this plot.</div>
          <div v-else class="muted-copy">Power is up to date for the current settings.</div>
        </aside>
        <div class="panel plot-panel">
          <template v-if="store.experiment.powerResults">
            <div class="card-tabs">
              <button class="card-tab" :class="{ active: powerViewTab === 'plot' }" @click="powerViewTab = 'plot'">Plot</button>
              <button class="card-tab" :class="{ active: powerViewTab === 'table' }" @click="powerViewTab = 'table'">Table</button>
            </div>
            <div v-if="powerViewTab === 'plot'" ref="powerPlot" class="plot-surface"></div>
            <div v-else class="power-tables">
              <div v-if="powerGroupTableColumns.length" class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th v-for="column in powerGroupTableColumns" :key="column">{{ column }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, index) in powerGroupTableRows" :key="`group-${index}`">
                      <td v-for="column in powerGroupTableColumns" :key="column">{{ formatTableValue(row[column]) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="powerCurveTableColumns.length" class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th v-for="column in powerCurveTableColumns" :key="column">{{ column }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, index) in powerCurveTableRows" :key="`curve-${index}`">
                      <td v-for="column in powerCurveTableColumns" :key="column">{{ formatTableValue(row[column]) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
          <div v-else class="plot-placeholder">Run Power to populate this plot.</div>
        </div>
      </section>

      <section class="plot-row">
        <aside class="controls-panel">
          <strong>Ancova</strong>
          <div class="muted-copy">Backend ANCOVA output is shown as raw JSON for now.</div>
          <BButton size="sm" variant="outline-secondary" :disabled="store.loaders.doAncova || !analysisDirty.ancova" @click="runAncova">
            <BSpinner v-if="store.loaders.doAncova" small />
            <span v-else>Run Ancova</span>
          </BButton>
          <div v-if="analysisDirty.ancova" class="muted-copy">Settings changed. Run Ancova to refresh this section.</div>
          <div v-else class="muted-copy">Ancova is up to date for the current settings.</div>
        </aside>
        <div class="panel plot-panel">
          <pre v-if="store.experiment.ancovaResults" class="result-pre">{{ prettyAncova }}</pre>
          <div v-else class="plot-placeholder">Run Ancova to populate this section.</div>
        </div>
      </section>

      
    </template>
  </div>
</template>

<script>
import { appStore } from '../store/appStore'
import { fetchDataFile, fetchPublicFiles, fetchSessionFile, runAnalysis } from '../services/registryService'
import { attachSessionMetadata, ensureExpMinute, parseCsv, preprocessDetail, preprocessSession } from '../utils/csv'
import { formatDate } from '../utils/format'
import { renderDistributionPlot, renderPowerPlot, renderQcPlot, renderRegressionPlot, renderTimeSeriesPlot, renderWeightPlot } from '../utils/plotting'

const numericalColumns = [
  'vo2', 'vco2', 'ee', 'ee.acc', 'rer', 'feed', 'feed.acc', 'drink', 'drink.acc',
  'xytot', 'xyamb', 'pedmeter', 'allmeter', 'wheel', 'wheel.acc', 'C13', 'enviro.temp',
  'subject.mass', 'body.temp', 'enviro.sound', 'exp.minute', 'enviro.light',
]

export default {
  name: 'AnalysisView',
  data() {
    return {
      store: appStore,
      publicFields: ['name', 'description', 'uploaded_at', 'actions'],
      explorerVariables: [
        { field: 'vo2', label: 'Oxygen Consumption (ml/hr)' },
        { field: 'vco2', label: 'Carbon Dioxide Production (ml/hr)' },
        { field: 'ee', label: 'Energy Expenditure (kcal/hr)' },
        { field: 'ee.acc', label: 'Cumulative Energy Expenditure (kcal)' },
        { field: 'rer', label: 'Respiratory Exchange Ratio' },
        { field: 'feed', label: 'Food Intake (kcal/hr)' },
        { field: 'feed.acc', label: 'Cumulative Food Intake (kcal)' },
        { field: 'drink', label: 'Water Intake (ml)' },
        { field: 'drink.acc', label: 'Cumulative Water Intake (ml)' },
        { field: 'xytot', label: 'Locomotor Activity (beam breaks)' },
        { field: 'xyamb', label: 'Ambulator Activity (beam breaks)' },
        { field: 'pedmeter', label: 'Pedestrian Locomotion (m)' },
        { field: 'allmeter', label: 'Distance in Cage (m)' },
        { field: 'body.temp', label: 'Body Temperature (C)' },
        { field: 'wheel', label: 'Wheel Running (counts)' },
        { field: 'wheel.acc', label: 'Total Wheel Running (counts)' },
        { field: 'subject.mass', label: 'Body Mass (g)' },
        { field: 'enviro.temp', label: 'Environmental Temperature (C)' },
      ],
      regressionYVariables: [
        { field: 'vo2', label: 'Oxygen Consumption (ml/hr)' },
        { field: 'vco2', label: 'Carbon Dioxide Production (ml/hr)' },
        { field: 'ee', label: 'Energy Expenditure (kcal/hr)' },
        { field: 'feed', label: 'Food Intake (kcal/hr)' },
      ],
      regressionXVariables: [
        { field: 'subject.mass', label: 'Total Mass (g)' },
        { field: 'xytot', label: 'Total Activity (beam breaks)' },
      ],
      timeOptions: {
        yVar: 'ee',
        smoothing: true,
        smoothWindow: 20,
        showMean: true,
        showIndividuals: false,
        showDarkLight: true,
        rangeStart: 0,
        rangeEnd: 24,
        removeOutliers: false,
      },
      distributionVariable: 'ee',
      regressionOptions: {
        xVar: 'subject.mass',
        yVar: 'ee',
        period: 'Total',
        showCI: true,
      },
      qcOptions: {
        nMassMeasurements: 5,
        hourStart: 0,
        hourEnd: 24,
      },
      powerOptions: {
        variable: 'ee',
        sampleSizesText: '4, 8, 12, 16, 20, 24',
        dayPhase: 'total',
        alpha: 0.05,
        hourStart: 0,
        hourEnd: 24,
      },
      loadingPublicFiles: false,
      analysisDirty: {
        qc: true,
        power: true,
        ancova: true,
      },
      suppressAnalysisDirtyWatch: false,
      groupColors: {},
      powerViewTab: 'plot',
    }
  },
  computed: {
    sessionMetadata() {
      return preprocessSession(this.store.experiment.sessionRows)
    },
    maxHour() {
      const hours = this.store.experiment.detailRows.map((row) => row.hour).filter((hour) => hour !== null)
      return hours.length ? Math.ceil(Math.max(...hours)) : 24
    },
    detailRowsWithGroups() {
      return attachSessionMetadata(this.store.experiment.detailRows, this.sessionMetadata).map((row) => ({
        ...row,
        color: this.groupColors[row.groupName] || row.color,
      }))
    },
    metadata() {
      return {
        experimentId: this.store.experiment.current?.name || this.store.experiment.current?.id || 'Current experiment',
        groups: [...new Set(this.detailRowsWithGroups.map((row) => row.groupName).filter(Boolean))],
        diets: this.sessionMetadata.dietNames,
        dietCalories: this.sessionMetadata.dietCal,
        subjects: new Set(this.store.experiment.detailRows.map((row) => row['subject.id'])).size,
      }
    },
    powerVariableOptions() {
      if (!this.store.experiment.detailRows.length) {
        return this.explorerVariables
      }

      const availableColumns = new Set(Object.keys(this.store.experiment.detailRows[0] || {}))
      return this.explorerVariables.filter((variable) => availableColumns.has(variable.field))
    },
    prettyAncova() {
      return JSON.stringify(this.store.experiment.ancovaResults, null, 2)
    },
    powerGroupTableRows() {
      const result = this.store.experiment.powerResults
      const rawGroups = result?.group_summary || result?.group_summaries || result?.group_stats || result?.groups || []

      if (Array.isArray(rawGroups)) {
        return rawGroups.map((row) => this.normalizePowerGroupRow(row))
      }

      if (rawGroups && typeof rawGroups === 'object') {
        return Object.entries(rawGroups).map(([groupName, row]) =>
          this.normalizePowerGroupRow(row, groupName, result),
        )
      }

      return []
    },
    powerCurveTableRows() {
      const result = this.store.experiment.powerResults
      const curve = result?.power_curve || result?.curve || []
      return curve.map((row) => ({
        'sample.size': row['sample.size'] ?? row.n_per_group ?? row.sample_size ?? row.n,
        power: row.power,
      }))
    },
    powerGroupTableColumns() {
      return this.powerGroupTableRows.length ? ['groups', 'sample.size', 'pop.size', 'sums', 'means', 'variance', 'ss.dev', 'r.squared', 'entire.sd'] : []
    },
    powerCurveTableColumns() {
      return this.powerCurveTableRows.length ? ['sample.size', 'power'] : []
    },
  },
  watch: {
    detailRowsWithGroups: {
      deep: true,
      handler() {
        this.renderPlots()
      },
    },
    timeOptions: {
      deep: true,
      handler() {
        this.normalizeTimeRange()
        this.renderTimeSeries()
      },
    },
    distributionVariable() {
      this.renderDistribution()
    },
    regressionOptions: {
      deep: true,
      handler() {
        this.renderRegression()
        this.markAnalysisDirty('ancova')
      },
    },
    qcOptions: {
      deep: true,
      handler() {
        this.normalizeHourOptionRange(this.qcOptions)
        this.markAnalysisDirty('qc')
      },
    },
    powerOptions: {
      deep: true,
      handler() {
        this.normalizeHourOptionRange(this.powerOptions)
        this.markAnalysisDirty('power')
      },
    },
    powerViewTab(value) {
      if (value === 'plot') {
        this.$nextTick(() => {
          this.renderPower()
        })
      }
    },
    'store.experiment.qcResults'() {
      this.$nextTick(() => {
        this.renderQc()
      })
    },
    'store.experiment.powerResults'() {
      this.$nextTick(() => {
        this.renderPower()
      })
    },
    maxHour: {
      immediate: true,
      handler(value) {
        const safeValue = value || 24
        this.timeOptions.rangeEnd = safeValue
        this.qcOptions.hourEnd = safeValue
        this.powerOptions.hourEnd = safeValue
      },
    },
    groupColors: {
      deep: true,
      handler() {
        this.renderPlots()
      },
    },
  },
  async mounted() {
    if (!this.store.account.publicFiles.length) {
      this.loadingPublicFiles = true
      try {
        const files = await fetchPublicFiles()
        this.store.account.publicFiles = files.map((file) => ({ ...file, loading: false }))
      } finally {
        this.loadingPublicFiles = false
      }
    }

    if (this.store.experiment.current && this.store.experiment.sessionRows.length) {
      this.initializeGroupColors(this.sessionMetadata)
      this.resetAnalysisControlsForDataset()
      await this.runInitialAnalyses()
    }

    this.renderPlots()
  },
  methods: {
    formatDate,
    async openPublicExperiment(file) {
      const session = file.files.find((item) => item.file_type === 'session')
      const standard = file.files.find((item) => item.file_type === 'standard')

      if (!session || !standard) {
        return
      }

      file.loading = true
      try {
        const [dataCsv, sessionCsv] = await Promise.all([
          fetchDataFile(standard.id, this.store.auth.token, true),
          fetchSessionFile(session.id, this.store.auth.token, true),
        ])

        const detailRows = preprocessDetail(ensureExpMinute(parseCsv(dataCsv)), numericalColumns)
        const parsedSessionRows = parseCsv(sessionCsv)

        this.store.experiment.current = file
        this.store.experiment.detailRows = detailRows
        this.store.experiment.sessionRows = parsedSessionRows
        this.initializeGroupColors(preprocessSession(parsedSessionRows))
        this.resetAnalysisControlsForDataset()
        this.powerViewTab = 'plot'
        await this.runInitialAnalyses()
      } finally {
        file.loading = false
      }
    },
    renderPlots() {
      this.$nextTick(() => {
        this.renderTimeSeries()
        this.renderDistribution()
        this.renderRegression()
        this.renderQc()
        this.renderPower()
        this.renderWeight()
      })
    },
    async renderTimeSeries() {
      await renderTimeSeriesPlot(
        this.$refs.timePlot,
        this.detailRowsWithGroups,
        this.sessionMetadata,
        {
          ...this.timeOptions,
          rangeEnd: Math.min(this.timeOptions.rangeEnd, this.maxHour),
        },
        this.explorerVariables,
      )
    },
    async renderDistribution() {
      const yLabel = this.explorerVariables.find((variable) => variable.field === this.distributionVariable)?.label || this.distributionVariable
      await renderDistributionPlot(this.$refs.distributionPlot, this.detailRowsWithGroups, this.distributionVariable, {
        yLabel,
      })
    },
    async renderRegression() {
      const xLabel = this.regressionXVariables.find((variable) => variable.field === this.regressionOptions.xVar)?.label || this.regressionOptions.xVar
      const yLabel = this.regressionYVariables.find((variable) => variable.field === this.regressionOptions.yVar)?.label || this.regressionOptions.yVar
      await renderRegressionPlot(this.$refs.regressionPlot, this.detailRowsWithGroups, {
        ...this.regressionOptions,
        xLabel,
        yLabel,
      }, this.explorerVariables)
    },
    async runQc() {
      if (!this.store.experiment.current) {
        return
      }

      this.store.loaders.doQC = true
      try {
        const hourRange = this.normalizeHourRange(this.qcOptions.hourStart, this.qcOptions.hourEnd)
        this.store.experiment.qcResults = await runAnalysis(
          'qc',
          {
            session_id: this.store.experiment.current.files.find((file) => file.file_type === 'session')?.id,
            n_mass_measurements: this.clampInteger(this.qcOptions.nMassMeasurements, 1, 15, 5),
            hour_range: hourRange,
            min_hour: hourRange[0],
            max_hour: hourRange[1],
          },
          this.store.auth.token,
          this.store.experiment.current.public,
        )
        this.analysisDirty.qc = false
      } finally {
        this.store.loaders.doQC = false
      }
    },
    async runAncova() {
      if (!this.store.experiment.current) {
        return
      }

      this.store.loaders.doAncova = true
      try {
        this.store.experiment.ancovaResults = await runAnalysis(
          'ancova',
          {
            session_id: this.store.experiment.current.files.find((file) => file.file_type === 'session')?.id,
            variable: this.regressionOptions.yVar,
            mass_variable: this.regressionOptions.xVar,
            time_of_day: this.regressionOptions.period.toLowerCase(),
          },
          this.store.auth.token,
          this.store.experiment.current.public,
        )
        this.analysisDirty.ancova = false
      } finally {
        this.store.loaders.doAncova = false
      }
    },
    async runPower() {
      if (!this.store.experiment.current) {
        return
      }

      this.store.loaders.doPower = true
      try {
        const hourRange = this.normalizeHourRange(this.powerOptions.hourStart, this.powerOptions.hourEnd)
        this.store.experiment.powerResults = await runAnalysis(
          'power',
          {
            session_id: this.store.experiment.current.files.find((file) => file.file_type === 'session')?.id,
            variable: this.powerOptions.variable,
            mass_variable: 'subject.mass',
            time_of_day: this.powerOptions.dayPhase,
            sample_sizes: this.parseSampleSizes(this.powerOptions.sampleSizesText),
            alpha: this.powerOptions.alpha || 0.05,
            hour_range: hourRange,
            min_hour: hourRange[0],
            max_hour: hourRange[1],
          },
          this.store.auth.token,
          this.store.experiment.current.public,
        )
        this.analysisDirty.power = false
      } finally {
        this.store.loaders.doPower = false
      }
    },
    async renderQc() {
      const [hourStart, hourEnd] = this.normalizeHourRange(this.qcOptions.hourStart, this.qcOptions.hourEnd)
      await renderQcPlot(this.$refs.qcPlot, this.store.experiment.qcResults, {
        title: `QC: ${this.clampInteger(this.qcOptions.nMassMeasurements, 1, 15, 5)} mass measurements, hours ${hourStart}-${hourEnd}`,
        groupColors: this.groupColors,
      })
    },
    async renderPower() {
      const [hourStart, hourEnd] = this.normalizeHourRange(this.powerOptions.hourStart, this.powerOptions.hourEnd)
      const variableLabel = this.powerVariableOptions.find((variable) => variable.field === this.powerOptions.variable)?.label || this.powerOptions.variable
      const phaseLabel = {
        total: 'Full Day',
        dark: 'Dark',
        light: 'Light',
      }[this.powerOptions.dayPhase] || this.powerOptions.dayPhase

      await renderPowerPlot(this.$refs.powerPlot, this.store.experiment.powerResults, {
        title: `Power: ${variableLabel}, ${phaseLabel}, alpha ${this.powerOptions.alpha}, hours ${hourStart}-${hourEnd}`,
      })
    },
    async renderWeight() {
      await renderWeightPlot(this.$refs.weightPlot, this.detailRowsWithGroups, {
        xLabel: 'Total',
        yLabel: 'Mean (g)',
      })
    },
    clampInteger(value, min, max, fallback) {
      const parsed = Number.parseInt(value, 10)
      if (Number.isNaN(parsed)) {
        return fallback
      }
      return Math.max(min, Math.min(max, parsed))
    },
    normalizeHourRange(start, end) {
      const safeStart = Number.isFinite(Number(start)) ? Number(start) : 0
      const safeEnd = Number.isFinite(Number(end)) ? Number(end) : this.maxHour
      const normalizedStart = Math.max(0, Math.min(safeStart, safeEnd))
      const normalizedEnd = Math.min(this.maxHour, Math.max(safeStart, safeEnd))
      return [normalizedStart, normalizedEnd]
    },
    parseSampleSizes(text) {
      const parsed = `${text}`
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => !Number.isNaN(value) && value > 0)

      return parsed.length ? parsed : [4, 8, 12, 16, 20, 24]
    },
    initializeGroupColors(session) {
      const nextGroupColors = {}
      const fallbackPalette = ['#3B73C7', '#ED5F00', '#2E8B57', '#8B5CF6', '#B45309', '#D64550']

      session.groupNames.forEach((groupName, index) => {
        nextGroupColors[groupName] = session.colors[index] || fallbackPalette[index % fallbackPalette.length]
      })

      this.groupColors = nextGroupColors
    },
    normalizeTimeRange() {
      const normalized = this.normalizeHourRange(this.timeOptions.rangeStart, this.timeOptions.rangeEnd)
      this.timeOptions.rangeStart = normalized[0]
      this.timeOptions.rangeEnd = normalized[1]
    },
    normalizeHourOptionRange(optionSet) {
      const normalized = this.normalizeHourRange(optionSet.hourStart, optionSet.hourEnd)
      optionSet.hourStart = normalized[0]
      optionSet.hourEnd = normalized[1]
    },
    isSelectedDataset(file) {
      return this.store.experiment.current?.id === file.id
    },
    formatTableValue(value) {
      if (typeof value === 'number') {
        return value.toFixed(2)
      }
      return value
    },
    normalizePowerGroupRow(row, fallbackGroupName = '', result = this.store.experiment.powerResults) {
      const sampleSize = row['sample.size'] ?? row.sample_size ?? row.sampleSize ?? row.n ?? row.sample?.size
      const mean = row.means ?? row.mean
      const variance = row.variance ?? row.var
      const sum = row.sums ?? row.sum ?? (sampleSize != null && mean != null ? sampleSize * mean : undefined)
      const standardDeviation = row['ss.dev'] ?? row.ss_dev ?? row.sd ?? row.std_dev ?? (variance != null ? Math.sqrt(variance) : undefined)
      const populationSize = row['pop.size'] ?? row.pop_size ?? row.population_size ?? row.popSize ?? result?.population_size ?? result?.pop_size

      return {
        groups: row.groups ?? row.group ?? row.group_name ?? fallbackGroupName,
        'sample.size': sampleSize,
        'pop.size': populationSize,
        sums: sum,
        means: mean,
        variance,
        'ss.dev': standardDeviation,
        'r.squared': row['r.squared'] ?? row.r_squared ?? row.rsquared ?? row.r2 ?? result?.effect_size?.r_squared,
        'entire.sd': row['entire.sd'] ?? row.entire_sd ?? row.overall_sd ?? result?.overall_sd,
      }
    },
    markAnalysisDirty(type) {
      if (this.suppressAnalysisDirtyWatch || !this.store.experiment.current) {
        return
      }

      this.analysisDirty[type] = true
    },
    resetAnalysisControlsForDataset() {
      this.suppressAnalysisDirtyWatch = true
      this.timeOptions.rangeStart = 0
      this.timeOptions.rangeEnd = this.maxHour
      this.qcOptions.hourStart = 0
      this.qcOptions.hourEnd = this.maxHour
      this.powerOptions.hourStart = 0
      this.powerOptions.hourEnd = this.maxHour

      if (!this.powerVariableOptions.find((option) => option.field === this.powerOptions.variable)) {
        this.powerOptions.variable = this.powerVariableOptions[0]?.field || 'ee'
      }

      this.analysisDirty.qc = true
      this.analysisDirty.power = true
      this.analysisDirty.ancova = true

      this.$nextTick(() => {
        this.suppressAnalysisDirtyWatch = false
      })
    },
    async runInitialAnalyses() {
      await Promise.all([
        this.runQc(),
        this.runPower(),
        this.runAncova(),
      ])
    },
  },
}
</script>
