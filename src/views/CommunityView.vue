<template>
  <div class="page-column">
    <section class="community-toolbar">
      <div class="controls-panel controls-panel--tight">
        <strong>All Datasets</strong>
        <select v-model="selectedExperiments" multiple class="multi-select">
          <option v-for="experiment in uniqueExperiments" :key="experiment" :value="experiment">
            {{ experiment }}
          </option>
        </select>
        <div class="button-row">
          <button class="btn btn-outline-secondary btn-sm" @click="selectedExperiments = [...uniqueExperiments]">Select All</button>
          <button class="btn btn-outline-secondary btn-sm" @click="selectedExperiments = []">Clear</button>
        </div>
      </div>

      <div class="controls-panel controls-panel--tight">
        <strong>Compare Dataset</strong>
        <select v-model="highlightedExperiments" multiple class="multi-select">
          <option v-for="experiment in selectedExperiments" :key="experiment" :value="experiment">
            {{ experiment }}
          </option>
        </select>
        <button class="btn btn-outline-secondary btn-sm" @click="highlightedExperiments = []">Clear Highlights</button>
      </div>
    </section>

    <section class="plot-row plot-row--reverse">
      <aside class="controls-panel">
        <strong>Variables</strong>
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
        <div ref="summaryPlot" class="plot-surface"></div>
      </div>
    </section>
  </div>
</template>

<script>
import { appStore } from '../store/appStore'
import { parseCsv, preprocessSummary } from '../utils/csv'
import { purgePlot } from '../utils/plotting/core'
import { renderSummaryRegressionPlot } from '../utils/plotting/summary-regression'

export default {
  name: 'CommunityView',
  data() {
    return {
      store: appStore,
      numericVars: [
        'Total.Mass',
        'Lean.Mass',
        'Fat.Mass',
        'Energy.Expenditure..kcal.hr.',
        'Food.Intake..kcal.hr.',
        'Oxygen.Consumption..ml.hr.',
        'Carbon.Dioxide.Production..ml.hr.',
        'Respiratory.Exchange.Ratio',
      ],
      categoricalVars: [
        'experiment_id',
        'subject.id',
        'species',
        'tissue',
        'Group',
        'diet_names',
        'strain',
        'genetic_background',
        'sex',
        'system',
        'location',
        'treatment',
        'Time.of.day',
        'investigator',
      ],
      xVar: 'Total.Mass',
      yVar: 'Energy.Expenditure..kcal.hr.',
      groupVar: 'Time.of.day',
      selectedExperiments: [],
      highlightedExperiments: [],
    }
  },
  computed: {
    uniqueExperiments() {
      return [...new Set(this.store.community.summaryRows.map((row) => row.experiment_id))]
    },
  },
  watch: {
    xVar() {
      this.renderPlot()
    },
    yVar() {
      this.renderPlot()
    },
    groupVar() {
      this.renderPlot()
    },
    selectedExperiments() {
      this.renderPlot()
    },
    highlightedExperiments() {
      this.renderPlot()
    },
  },
  async mounted() {
    if (!this.store.community.summaryLoaded) {
      const response = await fetch('/calrepo_summary_v1.csv')
      const csv = await response.text()
      this.store.community.summaryRows = preprocessSummary(parseCsv(csv))
      this.store.community.summaryLoaded = true
    }

    this.selectedExperiments = [...this.uniqueExperiments]
    this.renderPlot()
  },
  async beforeUnmount() {
    await purgePlot(this.$refs.summaryPlot)
  },
  methods: {
    renderPlot() {
      this.$nextTick(() => {
        renderSummaryRegressionPlot(this.$refs.summaryPlot, this.store.community.summaryRows, {
          xVar: this.xVar,
          yVar: this.yVar,
          groupVar: this.groupVar,
          selectedExperiments: this.selectedExperiments,
          highlightedExperiments: this.highlightedExperiments,
        })
      })
    },
  },
}
</script>
