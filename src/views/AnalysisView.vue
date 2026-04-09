<template>
  <div class="page-column">
    <section class="panel panel--spaced">
      <div v-if="store.auth.token" class="card-tabs">
        <button class="card-tab" :class="{ active: datasetSourceTab === 'public' }" @click="datasetSourceTab = 'public'">
          Public Datasets
        </button>
        <button class="card-tab" :class="{ active: datasetSourceTab === 'private' }" @click="datasetSourceTab = 'private'">
          Your Datasets
        </button>
      </div>
      <strong>{{ datasetTableTitle }}</strong>
      <div v-if="loadingPublicFiles" class="empty-state">
        <BSpinner small />
      </div>
      <BTable v-else-if="datasetTableItems.length" :items="datasetTableItems" :fields="publicFields" small hover striped>
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
          <BButton
            v-else
            size="sm"
            variant="primary"
            @click="datasetSourceTab === 'private' ? openPrivateExperiment(slot.item) : openPublicExperiment(slot.item)"
          >
            <BSpinner v-if="slot.item.loading" small />
            <span v-else>Open</span>
          </BButton>
        </template>
      </BTable>
      <div v-else class="empty-state">
        {{ datasetSourceTab === 'private' ? 'No private datasets found.' : 'No public datasets found.' }}
      </div>
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
        <label class="checkbox-row">
          <input v-model="analysisOptions.removeOutliers" type="checkbox" />
          Remove outliers globally
        </label>
      </section>

      <section class="plot-row">
        <aside class="controls-panel">
          <strong>Time-Series Options</strong>
          <label class="control-stack">
            Metabolic Variable
            <select v-model="timeOptions.yVar">
              <option v-for="variable in timeSeriesVariables" :key="variable.field" :value="variable.field">
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
              <option v-for="variable in boxPlotVariables" :key="variable.field" :value="variable.field">
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

          <label class="checkbox-row">
            <input v-model="regressionOptions.showStatsLegend" type="checkbox" />
            Show Stats Legend
          </label>
        </aside>

        <div class="panel plot-panel">
          <div ref="regressionPlot" class="plot-surface"></div>
        </div>
      </section>

      <section class="plot-row">
        <aside class="controls-panel">
          <strong>Weight</strong>
          <div class="muted-copy">Group mean mass summaries with SEM.</div>
        </aside>
        <div class="panel plot-panel">
          <div class="card-tabs">
            <button class="card-tab" :class="{ active: weightViewTab === 'total' }" @click="weightViewTab = 'total'">
              Total Mass
            </button>
            <button
              v-if="weightHasCompositionData"
              class="card-tab"
              :class="{ active: weightViewTab === 'composition' }"
              @click="weightViewTab = 'composition'"
            >
              Mass Breakdown
            </button>
            <button
              v-if="weightHasCompositionData"
              class="card-tab"
              :class="{ active: weightViewTab === 'compositionPercent' }"
              @click="weightViewTab = 'compositionPercent'"
            >
              Composition %
            </button>
          </div>
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
          <div class="muted-copy warn-copy">⚠️ this section is still in progress and may show incorrect results.</div>
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
          <div class="muted-copy warn-copy">⚠️ this section is still in progress and may show incorrect results.</div>
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
          <div class="muted-copy">ANCOVA and ANOVA summaries are generated from the backend response.</div>
          <BButton size="sm" variant="outline-secondary" :disabled="store.loaders.doAncova || !analysisDirty.ancova" @click="runAncova">
            <BSpinner v-if="store.loaders.doAncova" small />
            <span v-else>Run Ancova</span>
          </BButton>
          <div v-if="analysisDirty.ancova" class="muted-copy">Settings changed. Run Ancova to refresh this section.</div>
          <div v-else class="muted-copy">Ancova is up to date for the current settings.</div>
        </aside>
        <div class="panel plot-panel">
          <div class="muted-copy warn-copy">⚠️ this section is still in progress and may show incorrect results.</div>
          <div v-if="store.experiment.ancovaResults" class="ancova-report">
            <div>
              <div v-if="ancovaMassVariableLabel" class="ancova-report__meta">
                Mass effect: {{ ancovaMassVariableLabel }}
              </div>
              <div class="ancova-report__meta">
                Signif. codes: &lt;0.001 `***`, &lt;0.01 `**`, &lt;0.05 `*`
              </div>
            </div>

            <section v-if="ancovaSummaryRows.length" class="ancova-block">
              <h3 class="ancova-block__title">ANCOVA / GLM</h3>
              <div class="table-wrap">
                <table class="data-table ancova-table">
                  <thead>
                    <tr>
                      <th rowspan="2" class="ancova-table__effect-header">Effect</th>
                      <th v-for="period in ancovaPeriods" :key="`ancova-period-${period}`" :colspan="ancovaEffects.length" class="txt-center">
                        {{ formatAnalysisPeriodLabel(period) }}
                      </th>
                    </tr>
                    <tr>
                      <template v-for="period in ancovaPeriods" :key="`ancova-columns-${period}`">
                        <th v-for="effect in ancovaEffects" :key="`ancova-${period}-${effect}`" class="txt-center">
                          {{ formatAnalysisEffectLabel(effect) }}
                        </th>
                      </template>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in ancovaSummaryRows" :key="`ancova-row-${row.variable}`">
                      <td class="ancova-table__effect-label">{{ row.label }}</td>
                      <template v-for="period in ancovaPeriods" :key="`ancova-values-${row.variable}-${period}`">
                        <td
                          v-for="effect in ancovaEffects"
                          :key="`ancova-value-${row.variable}-${period}-${effect}`"
                          class="txt-center"
                        >
                          {{ formatAnalysisPValue(row.periods[period]?.[effect]) }}
                        </td>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section v-if="anovaSummaryRows.length" class="ancova-block">
              <h3 class="ancova-block__title">ANOVA</h3>
              <div class="table-wrap">
                <table class="data-table ancova-table">
                  <thead>
                    <tr>
                      <th rowspan="2" class="ancova-table__effect-header">Effect</th>
                      <th v-for="period in anovaPeriods" :key="`anova-period-${period}`" :colspan="anovaEffects.length" class="txt-center">
                        {{ formatAnalysisPeriodLabel(period) }}
                      </th>
                    </tr>
                    <tr>
                      <template v-for="period in anovaPeriods" :key="`anova-columns-${period}`">
                        <th v-for="effect in anovaEffects" :key="`anova-${period}-${effect}`" class="txt-center">
                          {{ formatAnalysisEffectLabel(effect) }}
                        </th>
                      </template>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in anovaSummaryRows" :key="`anova-row-${row.variable}`">
                      <td class="ancova-table__effect-label">{{ row.label }}</td>
                      <template v-for="period in anovaPeriods" :key="`anova-values-${row.variable}-${period}`">
                        <td
                          v-for="effect in anovaEffects"
                          :key="`anova-value-${row.variable}-${period}-${effect}`"
                          class="txt-center"
                        >
                          {{ formatAnalysisPValue(row.periods[period]?.[effect]) }}
                        </td>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <div v-else class="plot-placeholder">Run Ancova to populate this section.</div>
        </div>
      </section>

      
    </template>
  </div>
</template>

<script>
import { appStore } from '../store/appStore'
import { fetchEnrichedData, fetchPublicFiles, fetchSessionConfig, fetchSessionFile, fetchUserFiles, runAnalysis } from '../services/registryService'
import { parseCsv } from '../utils/csv'
import { formatDate } from '../utils/format'
import { clearProcessCaches, preprocessDetail } from '../utils/process'
import { buildAnalysisSession } from '../utils/prep-for-analysis'
import { renderBoxPlot } from '../utils/plotting/box-plot'
import { purgePlot } from '../utils/plotting/core'
import { renderPowerPlot } from '../utils/plotting/power'
import { renderQcPlot } from '../utils/plotting/qc'
import { renderRegressionPlot } from '../utils/plotting/regression'
import { renderTimeSeriesPlot } from '../utils/plotting/time-series'
import { renderWeightPlot } from '../utils/plotting/weight'

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
      datasetSourceTab: 'public',
      explorerVariables: [
        { field: 'vo2', label: 'Oxygen Consumption (ml/hr)' },
        { field: 'vco2', label: 'Carbon Dioxide Production (ml/hr)' },
        { field: 'ee', label: 'Energy Expenditure (kcal/hr)' },
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
      timeSeriesVariableCatalog: [
        { field: 'vo2', label: 'Oxygen Consumption (ml/hr)' },
        { field: 'vco2', label: 'Carbon Dioxide Production (ml/hr)' },
        { field: 'ee', label: 'Energy Expenditure (kcal/hr)' },
        { field: 'ee.acc', label: 'Cumulative Energy Expenditure (kcal)' },
        { field: 'eb', label: 'Energy Balance (kcal/hr)' },
        { field: 'eb.acc', label: 'Cumulative Energy Balance (kcal)' },
        { field: 'rer', label: 'Respiratory Exchange Ratio' },
        { field: 'feed', label: 'Food Intake (kcal/hr)' },
        { field: 'feed.acc', label: 'Cumulative Food Intake (kcal)' },
        { field: 'drink', label: 'Water Intake (ml)' },
        { field: 'drink.acc', label: 'Cumulative Water Intake (ml)' },
        { field: 'xytot', label: 'Locomotor Activity (beam breaks)' },
        { field: 'xyamb', label: 'Ambulatory Activity (beam breaks)' },
        { field: 'pedmeter', label: 'Pedestrian Locomotion (m)' },
        { field: 'allmeter', label: 'Distance in Cage (m)' },
        { field: 'body.temp', label: 'Body Temperature (C)' },
        { field: 'wheel', label: 'Wheel Counts' },
        { field: 'wheel.acc', label: 'Total Wheel Counts' },
        { field: 'subject.mass', label: 'Body Mass (g)' },
        { field: 'C13', label: 'C13' },
        { field: 'enviro.temp', label: 'Environmental Temperature (C)' },
        { field: 'enviro.light', label: 'Environmental Light' },
        { field: 'enviro.sound', label: 'Environmental Sound' },
      ],
      boxPlotVariableCatalog: [
        { field: 'vo2', label: 'Oxygen Consumption (ml/hr)' },
        { field: 'vco2', label: 'Carbon Dioxide Production (ml/hr)' },
        { field: 'ee', label: 'Energy Expenditure (kcal/hr)' },
        { field: 'eb', label: 'Energy Balance (kcal/hr)' },
        { field: 'rer', label: 'Respiratory Exchange Ratio' },
        { field: 'feed', label: 'Food Intake (kcal/hr)' },
        { field: 'drink', label: 'Water Intake (ml)' },
        { field: 'xytot', label: 'Locomotor Activity (beam breaks)' },
        { field: 'xyamb', label: 'Ambulatory Activity (beam breaks)' },
        { field: 'pedmeter', label: 'Pedestrian Locomotion (m)' },
        { field: 'allmeter', label: 'Distance in Cage (m)' },
        { field: 'body.temp', label: 'Body Temperature (C)' },
        { field: 'wheel', label: 'Wheel Counts' },
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
      },
      analysisOptions: {
        removeOutliers: true,
      },
      distributionVariable: 'ee',
      regressionOptions: {
        xVar: 'subject.mass',
        yVar: 'ee',
        period: 'Total',
        showCI: true,
        showStatsLegend: true,
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
      pendingPlotRenders: new Set(),
      plotRenderFlushScheduled: false,
      suppressAnalysisDirtyWatch: false,
      groupColors: {},
      powerViewTab: 'plot',
      weightViewTab: 'total',
    }
  },
  computed: {
    analysisData() {
      return this.store.experiment.analysisData || {
        rows: this.store.experiment.detailRows,
        session: buildAnalysisSession(this.store.experiment.sessionRows),
      }
    },
    sessionMetadata() {
      return this.analysisData.session
    },
    maxHour() {
      const hours = this.analysisData.rows.map((row) => row.hour).filter((hour) => hour !== null)
      return hours.length ? Math.ceil(Math.max(...hours)) : 24
    },
    analysisRows() {
      return this.analysisData.rows
    },
    metadata() {
      const orderedGroups = (this.sessionMetadata.groupNames || []).filter(Boolean)
      const fallbackGroups = [...new Set(this.analysisRows.map((row) => row.groupName).filter(Boolean))]
      return {
        experimentId: this.store.experiment.current?.name || this.store.experiment.current?.id || 'Current experiment',
        groups: orderedGroups.length ? orderedGroups : fallbackGroups,
        diets: this.sessionMetadata.dietNames,
        dietCalories: this.sessionMetadata.dietCal,
        subjects: new Set(this.analysisData.rows.map((row) => row['subject.id'])).size,
      }
    },
    weightHasCompositionData() {
      const sessionHasComposition = (this.sessionMetadata.subjects || []).some((subject) =>
        subject.lean_mass != null
        || subject.fat_mass != null,
      )
      const detailRowsHaveComposition = this.analysisRows.some((row) =>
        row['subject.lean.mass'] != null
        || row['subject.fat.mass'] != null
        || row.subjectSession?.lean_mass != null
        || row.subjectSession?.fat_mass != null,
      )
      return sessionHasComposition || detailRowsHaveComposition
    },
    timeSeriesVariables() {
      if (!this.analysisRows.length) {
        return this.timeSeriesVariableCatalog
      }

      const alwaysInclude = new Set(['eb', 'eb.acc'])
      return this.timeSeriesVariableCatalog.filter((variable) => {
        if (alwaysInclude.has(variable.field)) {
          return true
        }

        const values = this.analysisRows
          .map((row) => row[variable.field])
          .filter((value) => value !== null && value !== undefined && value !== '')

        return new Set(values).size > 1
      })
    },
    boxPlotVariables() {
      if (!this.analysisRows.length) {
        return this.boxPlotVariableCatalog
      }

      const alwaysInclude = new Set(['eb'])
      return this.boxPlotVariableCatalog.filter((variable) => {
        if (alwaysInclude.has(variable.field)) {
          return true
        }

        const values = this.analysisRows
          .map((row) => row[variable.field])
          .filter((value) => value !== null && value !== undefined && value !== '')

        return new Set(values).size > 1
      })
    },
    powerVariableOptions() {
      if (!this.analysisData.rows.length) {
        return this.explorerVariables
      }

      const availableColumns = new Set(Object.keys(this.analysisData.rows[0] || {}))
      return this.explorerVariables.filter((variable) => availableColumns.has(variable.field))
    },
    ancovaMassVariableLabel() {
      const massVariable = this.store.experiment.ancovaResults?.mass_variable
      if (!massVariable) {
        return ''
      }

      return this.lookupVariableLabel(massVariable)
    },
    ancovaPeriods() {
      return this.collectAnalysisPeriods(this.store.experiment.ancovaResults?.ancova || [])
    },
    ancovaEffects() {
      return this.collectAnalysisEffects(this.store.experiment.ancovaResults?.ancova || [])
    },
    ancovaSummaryRows() {
      return this.normalizeAnalysisRows(this.store.experiment.ancovaResults?.ancova || [], this.ancovaPeriods)
    },
    anovaPeriods() {
      return this.collectAnalysisPeriods(this.store.experiment.ancovaResults?.anova || [])
    },
    anovaEffects() {
      return this.collectAnalysisEffects(this.store.experiment.ancovaResults?.anova || [])
    },
    anovaSummaryRows() {
      return this.normalizeAnalysisRows(this.store.experiment.ancovaResults?.anova || [], this.anovaPeriods)
    },
    regressionStatsLegendLines() {
      if (!this.store.experiment.ancovaResults) {
        return []
      }

      const effectKey = this.regressionOptions.xVar === 'xytot' ? 'activity' : 'mass'
      const title = this.regressionOptions.xVar === 'xytot' ? 'Activity' : 'Total Mass'
      const periodCandidates = {
        Total: ['full_day', 'total', 'all'],
        Light: ['light'],
        Dark: ['dark'],
      }[this.regressionOptions.period] || ['full_day', 'total']
      const yLabel = this.lookupVariableLabel(this.regressionOptions.yVar)
      const statsRow = this.ancovaSummaryRows.find((row) =>
        row.variable === this.regressionOptions.yVar || row.label === yLabel,
      )

      if (!statsRow) {
        return []
      }

      const effects = periodCandidates
        .map((periodKey) => statsRow.periods[periodKey])
        .find((value) => value && Object.keys(value).length) || {}

      if (!Object.keys(effects).length) {
        return []
      }

      return [
        title,
        `${effectKey === 'activity' ? 'Activity' : 'Mass'} effect: ${this.formatAnalysisPValue(effects.mass)}`,
        `Group effect: ${this.formatAnalysisPValue(effects.group)}`,
        `Interaction effect: ${this.formatAnalysisPValue(effects.interaction)}`,
      ]
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
    datasetTableItems() {
      return this.datasetSourceTab === 'private' ? this.store.account.userFiles : this.store.account.publicFiles
    },
    datasetTableTitle() {
      return this.datasetSourceTab === 'private' ? 'Your Private Datasets' : 'Public Datasets'
    },
  },
  watch: {
    analysisRows() {
      this.schedulePlotRenders(['time', 'distribution', 'regression', 'weight'])
    },
    timeOptions: {
      deep: true,
      handler() {
        this.normalizeTimeRange()
        this.ensureValidTimeSeriesVariable()
        this.schedulePlotRenders(['time'])
      },
    },
    distributionVariable() {
      this.ensureValidDistributionVariable()
      this.schedulePlotRenders(['distribution'])
    },
    regressionOptions: {
      deep: true,
      handler() {
        this.schedulePlotRenders(['regression'])
      },
    },
    'regressionOptions.xVar'() {
      this.markAnalysisDirty('ancova')
    },
    'regressionOptions.yVar'() {
      this.markAnalysisDirty('ancova')
    },
    'regressionOptions.period'() {
      this.markAnalysisDirty('ancova')
    },
    analysisOptions: {
      deep: true,
      handler() {
        clearProcessCaches()
        this.schedulePlotRenders(['time', 'distribution', 'regression'])
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
        this.schedulePlotRenders(['power'])
      }
    },
    weightViewTab() {
      this.schedulePlotRenders(['weight'])
    },
    'store.experiment.qcResults'() {
      this.schedulePlotRenders(['qc'])
    },
    'store.experiment.powerResults'() {
      this.schedulePlotRenders(['power'])
    },
    'store.experiment.ancovaResults'() {
      this.schedulePlotRenders(['regression'])
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
        this.schedulePlotRenders(['time', 'distribution', 'regression', 'qc', 'weight'])
      },
    },
    'store.experiment.current': {
      deep: true,
      handler() {
        this.syncDatasetSourceTab()
      },
    },
  },
  async mounted() {
    this.syncDatasetSourceTab()

    if (!this.store.account.publicFiles.length) {
      this.loadingPublicFiles = true
      try {
        const files = await fetchPublicFiles()
        this.store.account.publicFiles = files.map((file) => ({ ...file, loading: false }))
      } finally {
        this.loadingPublicFiles = false
      }
    }

    if (this.store.auth.token && !this.store.account.userFiles.length) {
      await this.loadPrivateFiles()
    }

    if (this.store.experiment.current && this.store.experiment.sessionRows.length) {
      clearProcessCaches()
      this.ensureExperimentAnalysisCache()
      this.initializeGroupColors(this.sessionMetadata)
      this.resetAnalysisControlsForDataset()
      this.syncAnalysisDirtyWithStoredResults()
      await this.runInitialAnalyses()
    }

    this.schedulePlotRenders(['time', 'distribution', 'regression', 'qc', 'power', 'weight'])
  },
  async beforeUnmount() {
    await Promise.all([
      purgePlot(this.$refs.timePlot),
      purgePlot(this.$refs.distributionPlot),
      purgePlot(this.$refs.regressionPlot),
      purgePlot(this.$refs.weightPlot),
      purgePlot(this.$refs.qcPlot),
      purgePlot(this.$refs.powerPlot),
    ])
  },
  methods: {
    formatDate,
    syncDatasetSourceTab() {
      if (this.store.auth.token && this.store.experiment.current && !this.store.experiment.current.public) {
        this.datasetSourceTab = 'private'
        return
      }

      this.datasetSourceTab = 'public'
    },
    async loadPrivateFiles() {
      const files = await fetchUserFiles(this.store.auth.token)
      this.store.account.userFiles = files.map((file) => ({ ...file, loading: false }))
    },
    lookupVariableLabel(variable) {
      const labelMaps = [
        ...this.explorerVariables,
        ...this.regressionYVariables,
        ...this.regressionXVariables,
      ]

      return labelMaps.find((entry) => entry.field === variable)?.label || variable
    },
    collectAnalysisPeriods(rows) {
      const periods = new Set()

      rows.forEach((row) => {
        Object.entries(row || {}).forEach(([key, value]) => {
          if (key !== 'variable' && key !== 'label' && value && typeof value === 'object' && !Array.isArray(value)) {
            periods.add(key)
          }
        })
      })

      const preferredOrder = ['full_day', 'light', 'dark']
      return [...periods].sort((left, right) => {
        const leftIndex = preferredOrder.indexOf(left)
        const rightIndex = preferredOrder.indexOf(right)

        if (leftIndex === -1 && rightIndex === -1) {
          return left.localeCompare(right)
        }

        if (leftIndex === -1) {
          return 1
        }

        if (rightIndex === -1) {
          return -1
        }

        return leftIndex - rightIndex
      })
    },
    collectAnalysisEffects(rows) {
      const effects = new Set()

      rows.forEach((row) => {
        Object.values(row || {}).forEach((value) => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.keys(value).forEach((effect) => effects.add(effect))
          }
        })
      })

      const preferredOrder = ['mass', 'group', 'interaction']
      return [...effects].sort((left, right) => {
        const leftIndex = preferredOrder.indexOf(left)
        const rightIndex = preferredOrder.indexOf(right)

        if (leftIndex === -1 && rightIndex === -1) {
          return left.localeCompare(right)
        }

        if (leftIndex === -1) {
          return 1
        }

        if (rightIndex === -1) {
          return -1
        }

        return leftIndex - rightIndex
      })
    },
    normalizeAnalysisRows(rows, periods) {
      return rows.map((row, index) => ({
        variable: row.variable || `row-${index}`,
        label: row.label || this.lookupVariableLabel(row.variable) || `Effect ${index + 1}`,
        periods: periods.reduce((accumulator, period) => {
          accumulator[period] = row[period] || {}
          return accumulator
        }, {}),
      }))
    },
    formatAnalysisPeriodLabel(period) {
      return `${period}`.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    },
    formatAnalysisEffectLabel(effect) {
      return `${effect}`.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    },
    formatAnalysisPValue(value) {
      if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return ''
      }

      const numericValue = Number(value)
      const stars = numericValue < 0.001 ? ' ***' : numericValue < 0.01 ? ' **' : numericValue < 0.05 ? ' *' : ''
      return `${numericValue.toFixed(4)}${stars}`
    },
    ensureExperimentAnalysisCache() {
      const sessionId = this.store.experiment.current?.files?.find((file) => file.file_type === 'session')?.id ?? null
      if (!sessionId) {
        return
      }

      if (this.store.experiment.analysisSessionId === sessionId) {
        return
      }

      this.store.experiment.analysisSessionId = sessionId
      this.store.experiment.qcResults = null
      this.store.experiment.powerResults = null
      this.store.experiment.ancovaResults = null
    },
    async openExperimentForAnalysis(file, isPublic) {
      const session = file.files.find((item) => item.file_type === 'session')
      // standard is not used directly after this point, but its presence is required:
      // the server's _load_session_and_standard_df will 404 if no standard file exists.
      const standard = file.files.find((item) => item.file_type === 'standard')

      if (!session || !standard) {
        return
      }

      file.loading = true
      try {
        clearProcessCaches()
        const [enrichedCsv, sessionCsv, sessionConfig] = await Promise.all([
          fetchEnrichedData(session.id, this.store.auth.token),
          fetchSessionFile(session.id, this.store.auth.token, isPublic),
          fetchSessionConfig(session.id, this.store.auth.token, isPublic),
        ])

        const parsedSessionRows = parseCsv(sessionCsv)
        const analysisSession = buildAnalysisSession(parsedSessionRows, sessionConfig)
        const enrichedRows = preprocessDetail(parseCsv(enrichedCsv), numericalColumns)

        this.store.experiment.current = file
        this.store.experiment.detailRows = enrichedRows
        this.store.experiment.sessionRows = parsedSessionRows
        this.store.experiment.analysisData = { rows: enrichedRows, session: analysisSession }
        this.syncDatasetSourceTab()
        this.ensureExperimentAnalysisCache()
        this.initializeGroupColors(this.sessionMetadata)
        this.resetAnalysisControlsForDataset()
        this.syncAnalysisDirtyWithStoredResults()
        this.powerViewTab = 'plot'
        await this.runInitialAnalyses()
      } finally {
        file.loading = false
      }
    },
    async openPublicExperiment(file) {
      await this.openExperimentForAnalysis(file, true)
    },
    async openPrivateExperiment(file) {
      await this.openExperimentForAnalysis(file, false)
    },
    schedulePlotRenders(plotKeys = []) {
      plotKeys.forEach((key) => this.pendingPlotRenders.add(key))

      if (this.plotRenderFlushScheduled) {
        return
      }

      this.plotRenderFlushScheduled = true
      this.$nextTick(() => {
        this.flushPlotRenders()
      })
    },
    async flushPlotRenders() {
      this.plotRenderFlushScheduled = false
      const plotKeys = [...this.pendingPlotRenders]
      this.pendingPlotRenders.clear()

      for (const key of plotKeys) {
        if (key === 'time') {
          await this.renderTimeSeries()
        } else if (key === 'distribution') {
          await this.renderDistribution()
        } else if (key === 'regression') {
          await this.renderRegression()
        } else if (key === 'qc') {
          await this.renderQc()
        } else if (key === 'power') {
          await this.renderPower()
        } else if (key === 'weight') {
          await this.renderWeight()
        }
      }
    },
    async renderTimeSeries() {
      this.ensureValidTimeSeriesVariable()
      await renderTimeSeriesPlot(
        this.$refs.timePlot,
        this.analysisData,
        {
          ...this.timeOptions,
          groupOrder: this.sessionMetadata.groupNames,
          groupColors: this.groupColors,
          removeOutliers: this.analysisOptions.removeOutliers,
          rangeEnd: Math.min(this.timeOptions.rangeEnd, this.maxHour),
        },
        this.timeSeriesVariables,
      )
    },
    async renderDistribution() {
      this.ensureValidDistributionVariable()
      const yLabel = this.boxPlotVariables.find((variable) => variable.field === this.distributionVariable)?.label || this.distributionVariable
      await renderBoxPlot(this.$refs.distributionPlot, this.analysisData, this.distributionVariable, {
        groupOrder: this.sessionMetadata.groupNames,
        groupColors: this.groupColors,
        yLabel,
        removeOutliers: this.analysisOptions.removeOutliers,
      })
    },
    async renderRegression() {
      const xLabel = this.regressionXVariables.find((variable) => variable.field === this.regressionOptions.xVar)?.label || this.regressionOptions.xVar
      const yLabel = this.regressionYVariables.find((variable) => variable.field === this.regressionOptions.yVar)?.label || this.regressionOptions.yVar
      await renderRegressionPlot(this.$refs.regressionPlot, this.analysisData, {
        ...this.regressionOptions,
        groupOrder: this.sessionMetadata.groupNames,
        groupColors: this.groupColors,
        removeOutliers: this.analysisOptions.removeOutliers,
        hourRange: this.sessionMetadata.hour_range,
        statsLegendLines: this.regressionOptions.showStatsLegend ? this.regressionStatsLegendLines : [],
        xLabel,
        yLabel,
      })
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
        groupOrder: this.sessionMetadata.groupNames,
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
      const mode = this.weightHasCompositionData ? this.weightViewTab : 'total'
      const labelsByMode = {
        total: { yLabel: 'Mean (g)' },
        composition: { yLabel: 'Mass (g)' },
        compositionPercent: { yLabel: 'Mean Composition of Total Mass (%)' },
      }

      await renderWeightPlot(this.$refs.weightPlot, this.analysisData, {
        mode,
        groupOrder: this.sessionMetadata.groupNames,
        groupColors: this.groupColors,
        ...labelsByMode[mode],
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
    ensureValidTimeSeriesVariable() {
      if (!this.timeSeriesVariables.length) {
        return
      }

      if (!this.timeSeriesVariables.some((variable) => variable.field === this.timeOptions.yVar)) {
        this.timeOptions.yVar = this.timeSeriesVariables[0].field
      }
    },
    ensureValidDistributionVariable() {
      if (!this.boxPlotVariables.length) {
        return
      }

      if (!this.boxPlotVariables.some((variable) => variable.field === this.distributionVariable)) {
        this.distributionVariable = this.boxPlotVariables[0].field
      }
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
      if (!this.weightHasCompositionData) {
        this.weightViewTab = 'total'
      }

      this.$nextTick(() => {
        this.suppressAnalysisDirtyWatch = false
      })
    },
    syncAnalysisDirtyWithStoredResults() {
      this.analysisDirty.qc = !this.store.experiment.qcResults
      this.analysisDirty.power = !this.store.experiment.powerResults
      this.analysisDirty.ancova = !this.store.experiment.ancovaResults
    },
    async runInitialAnalyses() {
      const pendingRuns = []

      if (!this.store.experiment.qcResults) {
        pendingRuns.push(this.runQc())
      }

      if (!this.store.experiment.powerResults) {
        pendingRuns.push(this.runPower())
      }

      if (!this.store.experiment.ancovaResults) {
        pendingRuns.push(this.runAncova())
      }

      if (pendingRuns.length) {
        await Promise.all(pendingRuns)
      }
    },
  },
}
</script>
