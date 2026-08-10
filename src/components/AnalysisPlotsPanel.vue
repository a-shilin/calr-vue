<template>
  <div class="plots-panel">
    <div style="display:flex; gap: 20px">
      <div style="display: flex; flex-direction: column; gap: 10px; max-width: 200px;">
        <span class="panel-label">Hours & Stats</span>
        <div class="session-stats-bar">
          <span class="session-stat"><strong>Subjects:</strong> {{ totalSubjects }}</span>
          <span class="session-stat"><strong>Duration (hrs):</strong> {{ maxHour }}</span>
          <span class="session-stat"><strong>Light start:</strong> {{ sessionMetadata.light_cycle_start ?? '—' }}h</span>
          <span class="session-stat"><strong>Dark start:</strong> {{ sessionMetadata.dark_cycle_start ?? '—' }}h</span>
        </div>
      </div>
  
      <div style="display: flex; flex-direction: column; gap: 10px; flex:1;">
        <span class="panel-label">Groups & Diets</span>
        <div v-if="sessionMetadata.groupNames && sessionMetadata.groupNames.length" class="group-cards-bar">
          <div
            v-for="(name, index) in sessionMetadata.groupNames"
            :key="name"
            class="group-info-card"
          >
            <div class="group-info-card__name">
              <span
                class="group-info-card__swatch"
                :style="`background: ${groupColors[name] || sessionMetadata.colors?.[index] || '#ccc'}`"
              ></span>
              <strong>{{ name }}</strong>
            </div>
            <div class="group-info-card__details">
              <span class="group-stat" :title="sessionMetadata.dietNames?.[index] || '—'"><strong>Diet:</strong><span style="white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">{{ sessionMetadata.dietNames?.[index] || '—' }}</span></span>
              <span v-if="sessionMetadata.dietCal?.[index] != null" class="group-stat"><strong>Diet kcal: </strong>{{ sessionMetadata.dietCal[index] }} kcal/g</span>
              <span v-if="groupSubjectCounts[index]" class="group-stat"><strong>Subjects </strong>{{ groupSubjectCounts[index] }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <span class="panel-label">Plots</span>
      <div class="plots-view-bar">
        <div v-if="plotViewMode === 'single'" class="card-tabs plots-single-nav">
          <button
            v-for="plot in plotNavItems"
            :key="plot.key"
            class="card-tab"
            :class="{ active: activePlotKey === plot.key }"
            @click="setActivePlot(plot.key)"
          >
            {{ plot.label }}
          </button>
        </div>
        <div class="plots-view-toggle">
          <button class="view-toggle-btn" :class="{ active: plotViewMode === 'stacked' }" @click="setPlotViewMode('stacked')">
            <i class="bi bi-window-stack"></i>
            All
          </button>
          <button class="view-toggle-btn" :class="{ active: plotViewMode === 'single' }" @click="setPlotViewMode('single')">
            <i class="bi bi-window"></i>
            Single
          </button>
        </div>
      </div>
      <div class="panel--spaced">
        <section class="plot-row" v-show="plotViewMode === 'stacked' || activePlotKey === 'time'">
          <aside class="controls-panel">
            <div class="plot-controls-title">
              <strong>Time-Series Options</strong>
              <div class="analysis-download-menu">
                <button class="plot-download-button" type="button" title="Download Time-Series data" @click.stop="togglePlotDownloadMenu('time')">
                  <i class="bi bi-download"></i>
                </button>
                <div v-if="activePlotDownloadMenu === 'time'" class="analysis-download-menu__popover plot-download-menu">
                  <button
                    v-for="option in plotDownloadOptions('time')"
                    :key="option.key"
                    class="analysis-download-menu__item"
                    :disabled="!canDownloadPlotData('time', option.key)"
                    @click="downloadPlotData('time', option.key)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
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

            <label class="checkbox-row">
              <input v-model="analysisOptions.removeOutliers" type="checkbox" />
              Remove Outliers
            </label>
    
            <label class="control-stack">
              Time Range
              <div class="range-row">
                <input v-model="draftTimeRange.start" type="number" :min="0" :max="maxHour" />
                <span>to</span>
                <input v-model="draftTimeRange.end" type="number" :min="0" :max="maxHour" />
                <BButton
                  class="time-range-apply"
                  size="sm"
                  :variant="timeRangeDirty ? 'primary' : 'outline-secondary'"
                  :disabled="!timeRangeDirty || !timeRangeDraftValid"
                  @click="applyTimeRange"
                >
                  Apply Range
                </BButton>
              </div>
            </label>
          </aside>
    
          <div class="panel plot-panel">
            <div class="plot-wrap">
              <div v-if="plotRendering.time" class="plot-loading"><BSpinner small /></div>
              <div ref="timePlot" class="plot-surface"></div>
            </div>
          </div>
        </section>
    
        <section class="plot-row" v-show="plotViewMode === 'stacked' || activePlotKey === 'distribution'">
          <aside class="controls-panel">
            <div class="plot-controls-title">
              <strong>Distribution Options</strong>
              <div class="analysis-download-menu">
                <button class="plot-download-button" type="button" title="Download Distribution data" @click.stop="togglePlotDownloadMenu('distribution')">
                  <i class="bi bi-download"></i>
                </button>
                <div v-if="activePlotDownloadMenu === 'distribution'" class="analysis-download-menu__popover plot-download-menu">
                  <button
                    v-for="option in plotDownloadOptions('distribution')"
                    :key="option.key"
                    class="analysis-download-menu__item"
                    :disabled="!canDownloadPlotData('distribution', option.key)"
                    @click="downloadPlotData('distribution', option.key)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
            <label class="control-stack">
              Metabolic Variable
              <select v-model="distributionVariable">
                <option v-for="variable in boxPlotVariables" :key="variable.field" :value="variable.field">
                  {{ variable.label }}
                </option>
              </select>
            </label>

            <label class="checkbox-row">
              <input v-model="analysisOptions.removeOutliers" type="checkbox" />
              Remove Outliers
            </label>

            <label class="control-stack">
              Time Range
              <div class="range-row">
                <input v-model="draftTimeRange.start" type="number" :min="0" :max="maxHour" />
                <span>to</span>
                <input v-model="draftTimeRange.end" type="number" :min="0" :max="maxHour" />
                <BButton
                  class="time-range-apply"
                  size="sm"
                  :variant="timeRangeDirty ? 'primary' : 'outline-secondary'"
                  :disabled="!timeRangeDirty || !timeRangeDraftValid"
                  @click="applyTimeRange"
                >
                  Apply Range
                </BButton>
              </div>
            </label>
          </aside>
    
          <div class="panel plot-panel">
            <div class="plot-wrap">
              <div v-if="plotRendering.distribution" class="plot-loading"><BSpinner small /></div>
              <div ref="distributionPlot" class="plot-surface"></div>
            </div>
          </div>
        </section>
    
        <section class="plot-row" v-show="plotViewMode === 'stacked' || activePlotKey === 'regression'">
          <aside class="controls-panel">
            <div class="plot-controls-title">
              <strong>Regression Options</strong>
              <div class="analysis-download-menu">
                <button class="plot-download-button" type="button" title="Download Regression data" @click.stop="togglePlotDownloadMenu('regression')">
                  <i class="bi bi-download"></i>
                </button>
                <div v-if="activePlotDownloadMenu === 'regression'" class="analysis-download-menu__popover plot-download-menu">
                  <button
                    v-for="option in plotDownloadOptions('regression')"
                    :key="option.key"
                    class="analysis-download-menu__item"
                    :disabled="!canDownloadPlotData('regression', option.key)"
                    @click="downloadPlotData('regression', option.key)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
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

            <label class="checkbox-row">
              <input v-model="analysisOptions.removeOutliers" type="checkbox" />
              Remove Outliers
            </label>

            <label class="control-stack">
              Time Range
              <div class="range-row">
                <input v-model="draftTimeRange.start" type="number" :min="0" :max="maxHour" />
                <span>to</span>
                <input v-model="draftTimeRange.end" type="number" :min="0" :max="maxHour" />
                <BButton
                  class="time-range-apply"
                  size="sm"
                  :variant="timeRangeDirty ? 'primary' : 'outline-secondary'"
                  :disabled="!timeRangeDirty || !timeRangeDraftValid"
                  @click="applyTimeRange"
                >
                  Apply Range
                </BButton>
              </div>
            </label>
          </aside>
    
          <div class="panel plot-panel">
            <div class="plot-wrap">
              <div v-if="plotRendering.regression" class="plot-loading"><BSpinner small /></div>
              <div ref="regressionPlot" class="plot-surface"></div>
              <div v-if="regressionOptions.showStatsLegend && regressionStatsLegendLines.length" class="regression-stats-legend">
                <div v-for="(line, index) in regressionStatsLegendLines" :key="`regression-stat-${index}`">
                  {{ line }}
                </div>
              </div>
            </div>
          </div>
        </section>
    
        <section class="plot-row" v-show="plotViewMode === 'stacked' || activePlotKey === 'weight'">
          <aside class="controls-panel">
            <div class="plot-controls-title">
              <strong>Weight</strong>
              <div class="analysis-download-menu">
                <button class="plot-download-button" type="button" title="Download Weight data" @click.stop="togglePlotDownloadMenu('weight')">
                  <i class="bi bi-download"></i>
                </button>
                <div v-if="activePlotDownloadMenu === 'weight'" class="analysis-download-menu__popover plot-download-menu">
                  <button
                    v-for="option in plotDownloadOptions('weight')"
                    :key="option.key"
                    class="analysis-download-menu__item"
                    :disabled="!canDownloadPlotData('weight', option.key)"
                    @click="downloadPlotData('weight', option.key)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
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
            <div class="plot-wrap">
              <div v-if="plotRendering.weight" class="plot-loading"><BSpinner small /></div>
              <div ref="weightPlot" class="plot-surface"></div>
            </div>
          </div>
        </section>
    
        <section class="plot-row" v-show="plotViewMode === 'stacked' || activePlotKey === 'qc'">
          <aside class="controls-panel">
            <div class="plot-controls-title">
              <strong>QC</strong>
              <div class="analysis-download-menu">
                <button class="plot-download-button" type="button" title="Download QC data" @click.stop="togglePlotDownloadMenu('qc')">
                  <i class="bi bi-download"></i>
                </button>
                <div v-if="activePlotDownloadMenu === 'qc'" class="analysis-download-menu__popover plot-download-menu">
                  <button
                    v-for="option in plotDownloadOptions('qc')"
                    :key="option.key"
                    class="analysis-download-menu__item"
                    :disabled="!canDownloadPlotData('qc', option.key)"
                    @click="downloadPlotData('qc', option.key)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
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
    
            <BButton size="sm" variant="outline-secondary" :disabled="qcLoading || !analysisDirty.qc" @click="runQc">
              <BSpinner v-if="qcLoading" small />
              <span v-else>Run QC</span>
            </BButton>
            <div v-if="analysisDirty.qc" class="muted-copy">Settings changed. Run QC to refresh this plot.</div>
            <div v-else class="muted-copy">QC is up to date for the current settings.</div>
          </aside>
          <div class="panel plot-panel">
            <div v-if="xp.analysisErrors.qc" class="muted-copy warn-copy">{{ xp.analysisErrors.qc }}</div>
            <div v-if="xp.qcResults" class="plot-wrap">
              <div v-if="plotRendering.qc" class="plot-loading"><BSpinner small /></div>
              <div ref="qcPlot" class="plot-surface"></div>
            </div>
            <div v-else class="plot-placeholder">Run QC to populate this plot.</div>
          </div>
        </section>
    
        <section class="plot-row" v-show="plotViewMode === 'stacked' || activePlotKey === 'power'">
          <aside class="controls-panel">
            <div class="plot-controls-title">
              <strong>Power</strong>
              <div class="analysis-download-menu">
                <button class="plot-download-button" type="button" title="Download Power data" @click.stop="togglePlotDownloadMenu('power')">
                  <i class="bi bi-download"></i>
                </button>
                <div v-if="activePlotDownloadMenu === 'power'" class="analysis-download-menu__popover plot-download-menu">
                  <button
                    v-for="option in plotDownloadOptions('power')"
                    :key="option.key"
                    class="analysis-download-menu__item"
                    :disabled="!canDownloadPlotData('power', option.key)"
                    @click="downloadPlotData('power', option.key)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
            <label class="control-stack">
              Variable
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

            <BButton size="sm" variant="outline-secondary" :disabled="powerLoading || !analysisDirty.power" @click="runPower">
              <BSpinner v-if="powerLoading" small />
              <span v-else>Run Power</span>
            </BButton>
            <div v-if="analysisDirty.power" class="muted-copy">Settings changed. Run Power to refresh this plot.</div>
            <div v-else class="muted-copy">Power is up to date for the current settings.</div>
          </aside>
          <div class="panel plot-panel">
            <div v-if="xp.analysisErrors.power" class="muted-copy warn-copy">{{ xp.analysisErrors.power }}</div>
            <template v-if="xp.powerResults">
              <div class="card-tabs">
                <button class="card-tab" :class="{ active: powerViewTab === 'plot' }" @click="powerViewTab = 'plot'">Plot</button>
                <button class="card-tab" :class="{ active: powerViewTab === 'table' }" @click="powerViewTab = 'table'">Table</button>
              </div>
              <div v-if="powerViewTab === 'plot'" class="plot-wrap">
                <div v-if="plotRendering.power" class="plot-loading"><BSpinner small /></div>
                <div ref="powerPlot" class="plot-surface"></div>
              </div>
              <div v-else class="power-tables">
                <div v-if="powerGroupTableColumns.length" class="table-wrap power-table-wrap power-table-wrap--summary">
                  <table class="data-table power-table power-table--summary">
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
                <div v-if="powerCurveTableColumns.length" class="table-wrap power-table-wrap">
                  <table class="data-table power-table">
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
    
        <section class="plot-row" v-show="plotViewMode === 'stacked' || activePlotKey === 'ancova'">
          <aside class="controls-panel">
            <div class="plot-controls-title">
              <strong>Analysis</strong>
              <div class="analysis-download-menu">
                <button class="plot-download-button" type="button" title="Download Analysis data" @click.stop="togglePlotDownloadMenu('ancova')">
                  <i class="bi bi-download"></i>
                </button>
                <div v-if="activePlotDownloadMenu === 'ancova'" class="analysis-download-menu__popover plot-download-menu">
                  <button
                    v-for="option in plotDownloadOptions('ancova')"
                    :key="option.key"
                    class="analysis-download-menu__item"
                    :disabled="!canDownloadPlotData('ancova', option.key)"
                    @click="downloadPlotData('ancova', option.key)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
            <div class="muted-copy">ANCOVA and ANOVA summaries are generated from the backend response.</div>
            <label class="control-stack">
              Covariate
              <select v-model="analysisTableOptions.massVariable">
                <option v-for="variable in analysisCovariateOptions" :key="variable.field" :value="variable.field">
                  {{ variable.label }}
                </option>
              </select>
            </label>

            <label v-if="showAnalysisGroupOrderControl" class="control-stack">
              Group Model
              <select v-model="analysisTableOptions.groupModel">
                <option value="ordered">Ordered trend</option>
                <option value="unordered">Pairwise vs reference</option>
              </select>
            </label>

            <label class="control-stack">
              Time Range
              <div class="range-row">
                <input v-model="draftTimeRange.start" type="number" :min="0" :max="maxHour" />
                <span>to</span>
                <input v-model="draftTimeRange.end" type="number" :min="0" :max="maxHour" />
                <BButton
                  class="time-range-apply"
                  size="sm"
                  :variant="timeRangeDirty ? 'primary' : 'outline-secondary'"
                  :disabled="!timeRangeDirty || !timeRangeDraftValid"
                  @click="applyTimeRange"
                >
                  Apply Range
                </BButton>
              </div>
            </label>

            <BButton size="sm" variant="outline-secondary" :disabled="ancovaLoading || !analysisDirty.ancova" @click="runAncova">
              <BSpinner v-if="ancovaLoading" small />
              <span v-else>Run Analysis</span>
            </BButton>
            <div v-if="analysisDirty.ancova" class="muted-copy">Settings changed. Run Analysis to refresh this section.</div>
            <div v-else class="muted-copy">Analysis is up to date for the current settings.</div>
          </aside>
          <div class="panel plot-panel">
            <div v-if="xp.analysisErrors.ancova" class="muted-copy warn-copy">{{ xp.analysisErrors.ancova }}</div>
            <div v-if="xp.ancovaResults" class="ancova-report">
              <div>
                <div v-if="ancovaMassVariableLabel" class="ancova-report__meta">
                  Mass effect: {{ ancovaMassVariableLabel }}
                </div>
                <div class="ancova-report__meta">
                  Signif. codes: &lt;0.001 `***`, &lt;0.01 `**`, &lt;0.05 `*`
                </div>
              </div>
    
              <section v-for="section in ancovaReportSections" :key="`ancova-section-${section.key}`" class="ancova-block">
                <h3 class="ancova-block__title">{{ section.title }}</h3>
                <div class="table-wrap">
                  <table class="data-table ancova-table">
                    <thead>
                      <tr>
                        <th rowspan="2" class="ancova-table__effect-header">Effect</th>
                        <th v-for="period in section.periods" :key="`ancova-period-${section.key}-${period}`" :colspan="section.effects.length" class="txt-center">
                          {{ formatAnalysisPeriodLabel(period) }}
                        </th>
                      </tr>
                      <tr>
                        <template v-for="period in section.periods" :key="`ancova-columns-${section.key}-${period}`">
                          <th v-for="effect in section.effects" :key="`ancova-${section.key}-${period}-${effect}`" class="txt-center">
                            {{ formatAnalysisEffectLabel(effect) }}
                          </th>
                        </template>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in section.rows" :key="`ancova-row-${section.key}-${row.variable}`">
                        <td class="ancova-table__effect-label">{{ row.label }}</td>
                        <template v-for="period in section.periods" :key="`ancova-values-${section.key}-${row.variable}-${period}`">
                          <td
                            v-for="effect in section.effects"
                            :key="`ancova-value-${section.key}-${row.variable}-${period}-${effect}`"
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
    
              <section v-for="section in anovaReportSections" :key="`anova-section-${section.key}`" class="ancova-block">
                <h3 class="ancova-block__title">{{ section.title }}</h3>
                <div class="table-wrap">
                  <table class="data-table ancova-table">
                    <thead>
                      <tr>
                        <th rowspan="2" class="ancova-table__effect-header">Effect</th>
                        <th v-for="period in section.periods" :key="`anova-period-${section.key}-${period}`" :colspan="section.effects.length" class="txt-center">
                          {{ formatAnalysisPeriodLabel(period) }}
                        </th>
                      </tr>
                      <tr>
                        <template v-for="period in section.periods" :key="`anova-columns-${section.key}-${period}`">
                          <th v-for="effect in section.effects" :key="`anova-${section.key}-${period}-${effect}`" class="txt-center">
                            {{ formatAnalysisEffectLabel(effect) }}
                          </th>
                        </template>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in section.rows" :key="`anova-row-${section.key}-${row.variable}`">
                        <td class="ancova-table__effect-label">{{ row.label }}</td>
                        <template v-for="period in section.periods" :key="`anova-values-${section.key}-${row.variable}-${period}`">
                          <td
                            v-for="effect in section.effects"
                            :key="`anova-value-${section.key}-${row.variable}-${period}-${effect}`"
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
            <div v-else class="plot-placeholder">Run Analysis to populate this section.</div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import { appStore } from '../store/appStore'
import { runAnalysis } from '../services/registryService'
import { stringifyCsv } from '../utils/csv'
import {
  buildPlotDownloadFilename,
  buildPlotDownloadRows,
  canDownloadPlotData,
  normalizeCsvRows,
  plotDownloadOptions as getPlotDownloadOptions,
} from '../utils/plot-downloads'
import { renderBoxPlot } from '../utils/plotting/box-plot'
import { getPlotly, purgePlot } from '../utils/plotting/core'
import { renderPowerPlot } from '../utils/plotting/power'
import { renderQcPlot } from '../utils/plotting/qc'
import { renderRegressionPlot } from '../utils/plotting/regression'
import { renderTimeSeriesPlot } from '../utils/plotting/time-series'
import { renderWeightPlot } from '../utils/plotting/weight'

export default {
  name: 'AnalysisPlotsPanel',
  props: {
    analysisData: { type: Object, required: true },
    sessionMetadata: { type: Object, required: true },
    maxHour: { type: Number, default: 24 },
    groupColors: { type: Object, required: true },
    analysisOptions: { type: Object, required: true },
    context: { type: String, default: 'experiment' },
    defaultViewMode: { type: String, default: 'stacked' },
  },
  data() {
    return {
      store: appStore,
      plotViewMode: this.defaultViewMode,
      activePlotKey: 'time',
      plotNavItems: [
        { key: 'time', label: 'Time Series' },
        { key: 'distribution', label: 'Distribution' },
        { key: 'regression', label: 'Regression' },
        { key: 'weight', label: 'Weight' },
        { key: 'qc', label: 'QC' },
        { key: 'power', label: 'Power' },
        { key: 'ancova', label: 'Analysis' },
      ],
      explorerVariables: [
        { field: 'vo2', label: 'Oxygen Consumption (ml/hr)' },
        { field: 'vco2', label: 'Carbon Dioxide Production (ml/hr)' },
        { field: 'ee', label: 'Energy Expenditure (kcal/hr)' },
        { field: 'drink', label: 'Water Intake (ml/hr)' },
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
      powerDependencyCatalog: [
        { field: 'ee', label: 'Energy.Expenditure' },
        { field: 'feed', label: 'Total.Food' },
        { field: 'xytot', label: 'Locomotor.Activity' },
        { field: 'rer', label: 'Respiratory.Exchange.Ratio' },
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
        { field: 'drink', label: 'Water Intake (ml/hr)' },
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
        { field: 'drink', label: 'Water Intake (ml/hr)' },
        { field: 'xytot', label: 'Locomotor Activity (beam breaks)' },
        { field: 'xyamb', label: 'Ambulatory Activity (beam breaks)' },
        { field: 'pedmeter', label: 'Pedestrian Locomotion (m/hr)' },
        { field: 'allmeter', label: 'Distance in Cage (m/hr)' },
        { field: 'body.temp', label: 'Body Temperature (C)' },
        { field: 'wheel', label: 'Wheel Counts' },
      ],
      regressionYVariables: [
        { field: 'vo2', label: 'Oxygen Consumption (ml/hr)' },
        { field: 'vco2', label: 'Carbon Dioxide Production (ml/hr)' },
        { field: 'ee', label: 'Energy Expenditure (kcal/hr)' },
        { field: 'feed', label: 'Food Intake (kcal/hr)' },
      ],
      regressionXVariableCatalog: [
        { field: 'subject.mass', label: 'Total Mass (g)' },
        { field: 'subject.lean.mass', label: 'Lean Mass (g)', optional: true },
        { field: 'subject.fat.mass', label: 'Fat Mass (g)', optional: true },
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
      draftTimeRange: {
        start: '0',
        end: '24',
      },
      distributionVariable: 'ee',
      regressionOptions: {
        xVar: 'subject.mass',
        yVar: 'ee',
        period: 'Total',
        showCI: true,
        showStatsLegend: true,
      },
      analysisTableOptions: {
        massVariable: 'total_mass',
        groupModel: 'unordered',
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
      analysisDirty: {
        qc: true,
        power: true,
        ancova: true,
      },
      pendingPlotRenders: new Set(),
      plotRenderFlushScheduled: false,
      plotRendering: {
        time: false,
        distribution: false,
        regression: false,
        weight: false,
        qc: false,
        power: false,
      },
      suppressAnalysisDirtyWatch: false,
      sharedAnalysisRefreshTimer: null,
      activePlotDownloadMenu: null,
      powerViewTab: 'plot',
      weightViewTab: 'total',
    }
  },
  computed: {
    xp() {
      return this.store[this.context]
    },
    qcLoading() {
      return this.context === 'builderAnalysis' ? this.store.loaders.doBuilderQC : this.store.loaders.doQC
    },
    powerLoading() {
      return this.context === 'builderAnalysis' ? this.store.loaders.doBuilderPower : this.store.loaders.doPower
    },
    ancovaLoading() {
      return this.context === 'builderAnalysis' ? this.store.loaders.doBuilderAncova : this.store.loaders.doAncova
    },
    analysisRows() {
      return this.analysisData.rows || []
    },
    totalSubjects() {
      return new Set(this.analysisRows.map((r) => r['subject.id']).filter(Boolean)).size
    },
    groupSubjectCounts() {
      const subjects = this.sessionMetadata.subjects || []
      return (this.sessionMetadata.groupNames || []).map((_, index) =>
        subjects.filter((s) => Number(s.groupIndex) === index).length,
      )
    },
    showAnalysisGroupOrderControl() {
      return (this.sessionMetadata.groupNames || []).length > 2
    },
    weightHasCompositionData() {
      const sessionHasComposition = (this.sessionMetadata.subjects || []).some((subject) =>
        subject.lean_mass != null || subject.fat_mass != null,
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
    regressionXVariables() {
      if (!this.analysisRows.length) {
        return this.regressionXVariableCatalog.filter((variable) => !variable.optional)
      }

      return this.regressionXVariableCatalog.filter((variable) => {
        if (!variable.optional) {
          return true
        }

        return this.hasCovariateData(variable.field)
      })
    },
    analysisCovariateOptions() {
      const options = [{ field: 'total_mass', label: 'Total Mass (g)' }]

      if (this.hasCovariateData('subject.lean.mass')) {
        options.push({ field: 'subject.lean.mass', label: 'Lean Mass (g)' })
      }

      return options
    },
    normalizedDraftTimeRange() {
      if (!this.timeRangeDraftValid) {
        return null
      }

      return this.normalizeHourRange(this.draftTimeRange.start, this.draftTimeRange.end)
    },
    timeRangeDraftValid() {
      const start = Number(this.draftTimeRange.start)
      const end = Number(this.draftTimeRange.end)
      return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end <= this.maxHour && start <= end
    },
    timeRangeDirty() {
      const normalized = this.normalizedDraftTimeRange
      if (!normalized) {
        return false
      }

      return normalized[0] !== this.timeOptions.rangeStart || normalized[1] !== this.timeOptions.rangeEnd
    },
    powerVariableOptions() {
      if (!this.analysisData.rows.length) {
        return this.powerDependencyCatalog
      }

      const availableColumns = new Set(Object.keys(this.analysisData.rows[0] || {}))
      return this.powerDependencyCatalog.filter((variable) => availableColumns.has(variable.field))
    },
    ancovaMassVariableLabel() {
      const massVariable = this.xp.ancovaResults?.mass_variable
      if (!massVariable) {
        return ''
      }

      return this.lookupVariableLabel(massVariable)
    },
    ancovaPeriods() {
      return this.collectAnalysisPeriods(this.xp.ancovaResults?.ancova || [])
    },
    ancovaEffects() {
      return this.collectAnalysisEffects(this.xp.ancovaResults?.ancova || [])
    },
    ancovaSummaryRows() {
      return this.normalizeAnalysisRows(this.xp.ancovaResults?.ancova || [], this.ancovaPeriods)
    },
    anovaPeriods() {
      return this.collectAnalysisPeriods(this.xp.ancovaResults?.anova || [])
    },
    anovaEffects() {
      return this.collectAnalysisEffects(this.xp.ancovaResults?.anova || [])
    },
    anovaSummaryRows() {
      return this.normalizeAnalysisRows(this.xp.ancovaResults?.anova || [], this.anovaPeriods)
    },
    ancovaReportSections() {
      return this.normalizeComparisonSections(
        this.xp.ancovaResults?.ancova_pairwise,
        this.xp.ancovaResults?.ancova || [],
        'ANCOVA / GLM',
        'GLM',
      )
    },
    anovaReportSections() {
      return this.normalizeComparisonSections(
        this.xp.ancovaResults?.anova_pairwise,
        this.xp.ancovaResults?.anova || [],
        'ANOVA',
        'ANOVA',
      )
    },
    regressionStatsLegendLines() {
      if (!this.xp.ancovaResults) {
        return []
      }

      const covariateLabel = this.regressionStatsCovariateLabel(this.regressionOptions.xVar)
      const periodCandidates = {
        Total: ['full_day', 'total', 'all'],
        Light: ['light'],
        Dark: ['dark'],
      }[this.regressionOptions.period] || ['full_day', 'total']
      const yLabel = this.lookupVariableLabel(this.regressionOptions.yVar)
      const pairwiseSections = Array.isArray(this.xp.ancovaResults.ancova_pairwise)
        ? this.xp.ancovaResults.ancova_pairwise
        : []
      const pairwiseEntries = pairwiseSections.map((section, index) => {
        const row = (Array.isArray(section.rows) ? section.rows : []).find((candidate) =>
          candidate.variable === this.regressionOptions.yVar || candidate.label === yLabel,
        )
        const effects = row
          ? periodCandidates
            .map((periodKey) => row[periodKey])
            .find((value) => value && Object.keys(value).length) || {}
          : {}

        return {
          key: section.comparison || section.label || `comparison-${index}`,
          label: section.label || section.comparison || `Comparison ${index + 1}`,
          group: section.group,
          reference: section.reference,
          effects,
        }
      }).filter((entry) => Object.keys(entry.effects).length)

      if (pairwiseEntries.length) {
        const showComparisonLabels = pairwiseEntries.length > 1
        const lines = [
          covariateLabel,
          `${this.regressionStatsMassEffectLabel(this.regressionOptions.xVar)}: ${this.formatAnalysisPValue(pairwiseEntries[0].effects.mass)}`,
        ]

        pairwiseEntries.forEach((entry) => {
          lines.push(`${this.regressionStatsComparisonEffectLabel('Group effect', entry, showComparisonLabels)}: ${this.formatAnalysisPValue(entry.effects.group)}`)
        })

        pairwiseEntries.forEach((entry) => {
          lines.push(`${this.regressionStatsComparisonEffectLabel('Interaction effect', entry, showComparisonLabels)}: ${this.formatAnalysisPValue(entry.effects.interaction)}`)
        })

        return lines
      }

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
        covariateLabel,
        `${this.regressionStatsMassEffectLabel(this.regressionOptions.xVar)}: ${this.formatAnalysisPValue(effects.mass)}`,
        `Group effect: ${this.formatAnalysisPValue(effects.group)}`,
        `Interaction effect: ${this.formatAnalysisPValue(effects.interaction)}`,
      ]
    },
    powerGroupTableRows() {
      const result = this.xp.powerResults
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
      const result = this.xp.powerResults
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
    analysisRows() {
      this.schedulePlotRenders(['time', 'distribution', 'regression', 'weight'])
    },
    timeOptions: {
      deep: true,
      handler() {
        this.ensureValidTimeSeriesVariable()
        this.schedulePlotRenders(['time', 'distribution', 'regression'])
      },
    },
    'timeOptions.rangeStart'() {
      this.markAnalysisDirty('ancova')
      this.scheduleSharedAnalysisRefresh()
    },
    'timeOptions.rangeEnd'() {
      this.markAnalysisDirty('ancova')
      this.scheduleSharedAnalysisRefresh()
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
      this.syncAnalysisCovariateFromRegression()
      this.scheduleSharedAnalysisRefresh()
    },
    regressionXVariables() {
      if (!this.regressionXVariables.some((variable) => variable.field === this.regressionOptions.xVar)) {
        this.regressionOptions.xVar = this.regressionXVariables[0]?.field || 'subject.mass'
      }
    },
    analysisTableOptions: {
      deep: true,
      handler() {
        this.ensureValidAnalysisCovariate()
        this.markAnalysisDirty('ancova')
      },
    },
    analysisCovariateOptions() {
      this.ensureValidAnalysisCovariate()
    },
    analysisOptions: {
      deep: true,
      handler() {
        this.schedulePlotRenders(['time', 'distribution', 'regression'])
        this.markAnalysisDirty('ancova')
      },
    },
    'sessionMetadata.remove_outliers'() {
      this.syncOutlierOptionFromSession()
    },
    'sessionMetadata.hour_range': {
      deep: true,
      handler() {
        if (this.suppressAnalysisDirtyWatch || !this.xp.current) {
          return
        }

        this.applySessionHourRangeToAnalysisControls()
        this.markAnalysisDirty('qc')
        this.markAnalysisDirty('power')
        this.markAnalysisDirty('ancova')
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
    'xp.qcResults'() {
      this.schedulePlotRenders(['qc'])
    },
    'xp.powerResults'() {
      this.schedulePlotRenders(['power'])
    },
    'xp.ancovaResults'() {
      this.schedulePlotRenders(['regression'])
    },
    maxHour: {
      immediate: true,
      handler(value) {
        const safeValue = Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 24
        this.timeOptions.rangeEnd = safeValue
        this.syncDraftTimeRangeFromApplied()
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
    'xp.current': {
      handler(newVal, oldVal) {
        if (newVal?.id !== oldVal?.id && newVal) {
          this.$nextTick(async () => {
            this.ensureExperimentAnalysisCache()
            this.resetAnalysisControlsForDataset()
            this.syncAnalysisDirtyWithStoredResults()
            this.powerViewTab = 'plot'
            await this.runInitialAnalyses()
          })
        }
      },
    },
    plotViewMode(newMode, oldMode) {
      if (newMode === 'stacked') {
        this.schedulePlotRenders(['time', 'distribution', 'regression', 'weight', 'qc', 'power'])
      } else if (newMode === 'single' && oldMode === 'stacked') {
        this.schedulePlotRenders([this.activePlotKey])
      }
    },
    activePlotKey(newKey) {
      if (this.plotViewMode === 'single') {
        this.schedulePlotRenders([newKey])
      }
    },
  },
  async mounted() {
    document.addEventListener('click', this.closePlotDownloadMenu)

    if (this.xp.current && this.analysisData?.rows?.length) {
      this.ensureExperimentAnalysisCache()
      this.resetAnalysisControlsForDataset()
      this.syncAnalysisDirtyWithStoredResults()
      await this.runInitialAnalyses()
    }

    this.schedulePlotRenders(['time', 'distribution', 'regression', 'qc', 'power', 'weight'])
  },
  async beforeUnmount() {
    document.removeEventListener('click', this.closePlotDownloadMenu)
    if (this.sharedAnalysisRefreshTimer) {
      clearTimeout(this.sharedAnalysisRefreshTimer)
      this.sharedAnalysisRefreshTimer = null
    }
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
    setPlotViewMode(mode) {
      this.plotViewMode = mode
    },
    setActivePlot(key) {
      this.activePlotKey = key
    },
    togglePlotDownloadMenu(key) {
      this.activePlotDownloadMenu = this.activePlotDownloadMenu === key ? null : key
    },
    closePlotDownloadMenu() {
      this.activePlotDownloadMenu = null
    },
    plotDownloadOptions(key) {
      return getPlotDownloadOptions(key)
    },
    canDownloadPlotData(key, optionKey = 'plotData') {
      return canDownloadPlotData(this.plotDownloadContext(), key, optionKey)
    },
    downloadPlotData(key, optionKey = 'plotData') {
      const context = this.plotDownloadContext()
      const rows = buildPlotDownloadRows(context, key, optionKey)
      if (!rows.length) {
        return
      }

      const sourceName = this.xp.current?.name || this.xp.current?.id || 'analysis'
      const filename = buildPlotDownloadFilename(key, optionKey, sourceName)
      this.triggerCsvDownload(filename, stringifyCsv(normalizeCsvRows(rows)))
      this.activePlotDownloadMenu = null
    },
    triggerCsvDownload(filename, text) {
      const blob = new Blob([text], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    },
    plotDownloadContext() {
      return {
        analysisRows: this.analysisRows,
        analysisOptions: this.analysisOptions,
        timeOptions: this.timeOptions,
        qcOptions: this.qcOptions,
        regressionOptions: this.regressionOptions,
        maxHour: this.maxHour,
        sessionMetadata: this.sessionMetadata,
        xp: this.xp,
        weightHasCompositionData: this.weightHasCompositionData,
        weightViewTab: this.weightViewTab,
        explorerVariables: this.explorerVariables,
        timeSeriesVariableCatalog: this.timeSeriesVariableCatalog,
        regressionYVariables: this.regressionYVariables,
        regressionXVariables: this.regressionXVariables,
      }
    },
    setQcLoading(value) {
      this.store.loaders[this.context === 'builderAnalysis' ? 'doBuilderQC' : 'doQC'] = value
    },
    setPowerLoading(value) {
      this.store.loaders[this.context === 'builderAnalysis' ? 'doBuilderPower' : 'doPower'] = value
    },
    setAncovaLoading(value) {
      this.store.loaders[this.context === 'builderAnalysis' ? 'doBuilderAncova' : 'doAncova'] = value
    },
    applyTimeRange() {
      const normalized = this.normalizedDraftTimeRange
      if (!normalized) {
        return
      }

      this.timeOptions.rangeStart = normalized[0]
      this.timeOptions.rangeEnd = normalized[1]
      this.syncDraftTimeRangeFromApplied()
    },
    syncDraftTimeRangeFromApplied() {
      this.draftTimeRange.start = `${this.timeOptions.rangeStart}`
      this.draftTimeRange.end = `${this.timeOptions.rangeEnd}`
    },
    sessionHourRange() {
      const range = this.sessionMetadata?.hour_range
      if (Array.isArray(range) && range.length >= 2) {
        const start = Number(range[0])
        const end = Number(range[1])
        if (Number.isFinite(start) && Number.isFinite(end) && start < end) {
          return this.normalizeHourRange(start, end)
        }
      }

      return this.normalizeHourRange(0, this.maxHour)
    },
    applySessionHourRangeToAnalysisControls() {
      const [start, end] = this.sessionHourRange()
      this.timeOptions.rangeStart = start
      this.timeOptions.rangeEnd = end
      this.syncDraftTimeRangeFromApplied()
      this.qcOptions.hourStart = start
      this.qcOptions.hourEnd = end
      this.powerOptions.hourStart = start
      this.powerOptions.hourEnd = end
    },
    hasCovariateData(field) {
      const sessionKeyByField = {
        'subject.mass': 'total_mass',
        'subject.lean.mass': 'lean_mass',
        'subject.fat.mass': 'fat_mass',
      }
      const sessionKey = sessionKeyByField[field]

      if (sessionKey && (this.sessionMetadata.subjects || []).some((subject) => this.toFiniteNumber(subject?.[sessionKey]) !== null)) {
        return true
      }

      return this.analysisRows.some((row) => {
        if (this.toFiniteNumber(row?.[field]) !== null) {
          return true
        }

        return sessionKey
          ? this.toFiniteNumber(row?.subjectSession?.[sessionKey]) !== null
          : false
      })
    },
    backendMassVariableForRegression() {
      if (this.regressionOptions.xVar === 'subject.mass') {
        return 'total_mass'
      }

      return this.regressionOptions.xVar
    },
    backendMassVariableForAnalysis() {
      return this.analysisTableOptions.massVariable || 'total_mass'
    },
    syncAnalysisCovariateFromRegression() {
      const regressionMassVariable = this.backendMassVariableForRegression()
      if (this.analysisTableOptions.massVariable !== regressionMassVariable) {
        this.analysisTableOptions.massVariable = regressionMassVariable
      }
    },
    toFiniteNumber(value) {
      if (value === null || value === undefined || value === '') {
        return null
      }

      const number = Number(value)
      return Number.isFinite(number) ? number : null
    },
    lookupVariableLabel(variable) {
      const aliases = {
        total_mass: 'Total Mass (g)',
      }

      if (aliases[variable]) {
        return aliases[variable]
      }

      const labelMaps = [
        ...this.explorerVariables,
        ...this.powerDependencyCatalog,
        ...this.regressionYVariables,
        ...this.regressionXVariables,
        ...this.analysisCovariateOptions,
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
    normalizeComparisonSections(pairwiseSections, fallbackRows, fallbackTitle, pairwiseTitle) {
      if (Array.isArray(pairwiseSections) && pairwiseSections.length) {
        return pairwiseSections.map((section, index) => {
          const rows = Array.isArray(section.rows) ? section.rows : []
          const periods = this.collectAnalysisPeriods(rows)
          return {
            key: section.comparison || section.label || `comparison-${index}`,
            title: `${pairwiseTitle} (${section.label || section.comparison || `Comparison ${index + 1}`})`,
            periods,
            effects: this.collectAnalysisEffects(rows),
            rows: this.normalizeAnalysisRows(rows, periods),
          }
        }).filter((section) => section.rows.length)
      }

      const periods = this.collectAnalysisPeriods(fallbackRows)
      const rows = this.normalizeAnalysisRows(fallbackRows, periods)
      return rows.length ? [{
        key: 'summary',
        title: fallbackTitle,
        periods,
        effects: this.collectAnalysisEffects(fallbackRows),
        rows,
      }] : []
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
    regressionStatsCovariateLabel(field) {
      const label = this.lookupVariableLabel(field)
      return `${label}`
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/^Body Mass$/i, 'Total Mass')
        .trim()
    },
    regressionStatsMassEffectLabel(field) {
      return field === 'xytot' ? 'Activity effect' : 'Mass effect'
    },
    regressionStatsComparisonEffectLabel(baseLabel, entry, showComparisonLabels) {
      if (!showComparisonLabels) {
        return baseLabel
      }

      const group = entry.group || `${entry.label}`.split('_vs_')[0] || 'Group'
      const reference = entry.reference || `${entry.label}`.split('_vs_')[1] || this.xp.ancovaResults?.reference_group || 'Reference'
      return `${baseLabel} (${group} vs ${reference})`
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
      const sessionId = this.xp.current?.files?.find((file) => file.file_type === 'session')?.id ?? null
      if (!sessionId) {
        return
      }

      if (this.xp.analysisSessionId === sessionId) {
        return
      }

      this.xp.analysisSessionId = sessionId
      this.xp.qcResults = null
      this.xp.powerResults = null
      this.xp.ancovaResults = null
      this.xp.analysisErrors.qc = null
      this.xp.analysisErrors.power = null
      this.xp.analysisErrors.ancova = null
    },
    schedulePlotRenders(plotKeys = []) {
      plotKeys.forEach((key) => this.pendingPlotRenders.add(key))

      if (this.plotRenderFlushScheduled) {
        return
      }

      this.plotRenderFlushScheduled = true
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.flushPlotRenders()
          })
        })
      })
    },
    async flushPlotRenders() {
      this.plotRenderFlushScheduled = false
      const plotKeys = [...this.pendingPlotRenders]
      this.pendingPlotRenders.clear()

      // Mark all pending plots as rendering upfront so all spinners appear at once
      plotKeys.forEach((key) => { if (key in this.plotRendering) this.plotRendering[key] = true })
      await this.$nextTick()

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
        if (key in this.plotRendering) {
          this.plotRendering[key] = false
        }
      }

      // After all renders, force a Plotly relayout so plots fill their containers correctly
      requestAnimationFrame(() => this.resizeAllPlots())
    },
    async resizeAllPlots() {
      const Plotly = await getPlotly()
      for (const refName of ['timePlot', 'distributionPlot', 'regressionPlot', 'weightPlot', 'qcPlot', 'powerPlot']) {
        const el = this.$refs[refName]
        if (el) {
          try { Plotly.Plots.resize(el) } catch {}
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
        hourRange: [
          this.timeOptions.rangeStart,
          Math.min(this.timeOptions.rangeEnd, this.maxHour),
        ],
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
        hourRange: [
          this.timeOptions.rangeStart,
          Math.min(this.timeOptions.rangeEnd, this.maxHour),
        ],
        xLabel,
        yLabel,
      })
    },
    async runQc() {
      if (!this.xp.current) {
        return
      }

      this.setQcLoading(true)
      try {
        this.xp.analysisErrors.qc = null
        const hourRange = this.normalizeHourRange(this.qcOptions.hourStart, this.qcOptions.hourEnd)
        this.xp.qcResults = await runAnalysis(
          'qc',
          {
            session_id: this.xp.current.files.find((file) => file.file_type === 'session')?.id,
            n_mass_measurements: this.clampInteger(this.qcOptions.nMassMeasurements, 1, 15, 5),
            hour_range: hourRange,
            min_hour: hourRange[0],
            max_hour: hourRange[1],
          },
          this.store.auth.token,
          this.xp.current.public,
        )
        this.analysisDirty.qc = false
      } catch (error) {
        this.xp.qcResults = null
        this.xp.analysisErrors.qc = this.normalizeAnalysisError(error, 'QC')
      } finally {
        this.setQcLoading(false)
      }
    },
    async runAncova() {
      if (!this.xp.current) {
        return
      }

      this.setAncovaLoading(true)
      try {
        this.xp.analysisErrors.ancova = null
        const hourRange = this.normalizeHourRange(this.timeOptions.rangeStart, this.timeOptions.rangeEnd)
        this.xp.ancovaResults = await runAnalysis(
          'ancova',
          {
            session_id: this.xp.current.files.find((file) => file.file_type === 'session')?.id,
            variable: this.regressionOptions.yVar,
            mass_variable: this.backendMassVariableForAnalysis(),
            ordered_groups: !this.showAnalysisGroupOrderControl || this.analysisTableOptions.groupModel === 'ordered',
            time_of_day: this.regressionOptions.period.toLowerCase(),
            hour_range: hourRange,
            min_hour: hourRange[0],
            max_hour: hourRange[1],
          },
          this.store.auth.token,
          this.xp.current.public,
        )
        this.analysisDirty.ancova = false
      } catch (error) {
        this.xp.ancovaResults = null
        this.xp.analysisErrors.ancova = this.normalizeAnalysisError(error, 'Analysis')
      } finally {
        this.setAncovaLoading(false)
      }
    },
    scheduleSharedAnalysisRefresh() {
      if (this.suppressAnalysisDirtyWatch || !this.xp.current) {
        return
      }

      if (this.sharedAnalysisRefreshTimer) {
        clearTimeout(this.sharedAnalysisRefreshTimer)
      }

      this.sharedAnalysisRefreshTimer = window.setTimeout(() => {
        this.sharedAnalysisRefreshTimer = null
        this.runAncova()
      }, 250)
    },
    async runPower() {
      if (!this.xp.current) {
        return
      }

      this.setPowerLoading(true)
      try {
        this.xp.analysisErrors.power = null
        const hourRange = this.normalizeHourRange(this.powerOptions.hourStart, this.powerOptions.hourEnd)
        this.xp.powerResults = await runAnalysis(
          'power',
          {
            session_id: this.xp.current.files.find((file) => file.file_type === 'session')?.id,
            variable: this.powerOptions.variable,
            mass_variable: 'total_mass',
            time_of_day: this.powerOptions.dayPhase,
            sample_sizes: this.parseSampleSizes(this.powerOptions.sampleSizesText),
            alpha: this.powerOptions.alpha || 0.05,
            hour_range: hourRange,
            min_hour: hourRange[0],
            max_hour: hourRange[1],
          },
          this.store.auth.token,
          this.xp.current.public,
        )
        this.analysisDirty.power = false
      } catch (error) {
        this.xp.powerResults = null
        this.xp.analysisErrors.power = this.normalizeAnalysisError(error, 'Power')
      } finally {
        this.setPowerLoading(false)
      }
    },
    async renderQc() {
      const [hourStart, hourEnd] = this.normalizeHourRange(this.qcOptions.hourStart, this.qcOptions.hourEnd)
      await renderQcPlot(this.$refs.qcPlot, this.xp.qcResults, {
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

      await renderPowerPlot(this.$refs.powerPlot, this.xp.powerResults, {
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
    ensureValidAnalysisCovariate() {
      if (!this.analysisCovariateOptions.some((variable) => variable.field === this.analysisTableOptions.massVariable)) {
        this.analysisTableOptions.massVariable = this.analysisCovariateOptions[0]?.field || 'total_mass'
      }
    },
    ensureValidPowerVariable() {
      if (!this.powerVariableOptions.length) {
        return
      }

      if (!this.powerVariableOptions.some((option) => option.field === this.powerOptions.variable)) {
        const defaultPowerVariable = this.powerVariableOptions.find((option) => option.field === 'ee')
        this.powerOptions.variable = defaultPowerVariable?.field || this.powerVariableOptions[0].field
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
    formatTableValue(value) {
      if (typeof value === 'number') {
        return value.toFixed(2)
      }
      return value
    },
    normalizeAnalysisError(error, label) {
      const fallbackMessage = `${label} could not be generated.`
      const sourceMessage = error?.message || ''

      if (!sourceMessage) {
        return fallbackMessage
      }

      try {
        const parsed = JSON.parse(sourceMessage)
        if (parsed?.detail) {
          return `${label} could not be generated: ${parsed.detail}`
        }
      } catch {
        // Ignore non-JSON error text and fall back below.
      }

      return `${label} could not be generated: ${sourceMessage}`
    },
    normalizePowerGroupRow(row, fallbackGroupName = '', result = this.xp.powerResults) {
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
      if (this.suppressAnalysisDirtyWatch || !this.xp.current) {
        return
      }

      this.analysisDirty[type] = true
    },
    resetAnalysisControlsForDataset() {
      this.suppressAnalysisDirtyWatch = true
      this.syncOutlierOptionFromSession()
      this.applySessionHourRangeToAnalysisControls()

      this.ensureValidPowerVariable()
      this.ensureValidAnalysisCovariate()
      this.syncAnalysisCovariateFromRegression()

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
    syncOutlierOptionFromSession() {
      if (typeof this.sessionMetadata?.remove_outliers !== 'boolean') {
        return
      }

      this.analysisOptions.removeOutliers = this.sessionMetadata.remove_outliers
    },
    syncAnalysisDirtyWithStoredResults() {
      this.analysisDirty.qc = !this.xp.qcResults
      this.analysisDirty.power = !this.xp.powerResults
      this.analysisDirty.ancova = !this.xp.ancovaResults
    },
    async runInitialAnalyses() {
      const pendingRuns = []

      if (!this.xp.qcResults) {
        pendingRuns.push(this.runQc())
      }

      if (!this.xp.powerResults) {
        pendingRuns.push(this.runPower())
      }

      if (!this.xp.ancovaResults) {
        pendingRuns.push(this.runAncova())
      }

      if (pendingRuns.length) {
        await Promise.all(pendingRuns)
      }
    },
  },
}
</script>
