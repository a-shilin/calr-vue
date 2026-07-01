<template>
  <div class="filter-popover">
    <div class="filter-popover__list">
      <button
        v-for="field in fields"
        :key="field.key"
        type="button"
        class="filter-popover__field-btn"
        :class="{ active: activeField?.key === field.key }"
        @mouseenter="activeFieldKey = field.key"
        @focus="activeFieldKey = field.key"
      >
        <span>{{ field.label }}</span>
        <span v-if="isFieldActive(field.key)" class="filter-popover__field-state">Applied</span>
      </button>
    </div>

    <div v-if="activeField" class="filter-popover__detail">
      <div class="filter-popover__detail-header">
        <strong>{{ activeField.label }}</strong>
        <button
          v-if="isFieldActive(activeField.key)"
          type="button"
          class="btn btn-link btn-sm filter-popover__clear-btn"
          @click="$emit('clear-field', activeField.key)"
        >
          Clear
        </button>
      </div>

      <div v-if="activeField.filterKind === 'numberRange'" class="filter-popover__range-panel">
        <DualRangeSlider
          :min="activeField.range.min"
          :max="activeField.range.max"
          :step="activeField.step || 1"
          :model-value="activeRange"
          @update:model-value="handleRangeChange(activeField.key, $event)"
        />
        <div class="filter-popover__range-limits">
          <span>Min: {{ formatNumber(activeField.range.min) }}</span>
          <span>Max: {{ formatNumber(activeField.range.max) }}</span>
        </div>
      </div>

      <div v-else class="filter-popover__options">
        <label
          v-for="option in activeField.options"
          :key="option.value"
          class="filter-popover__option"
        >
          <input
            :checked="isOptionSelected(activeField.key, option.value)"
            type="checkbox"
            @change="toggleCategoricalValue(activeField.key, option.value)"
          />
          <span class="filter-popover__option-label">{{ option.label }}</span>
          <span class="filter-popover__option-count">{{ option.count }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script>
import DualRangeSlider from './DualRangeSlider.vue'

function normalizeRangeValue(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export default {
  name: 'DatasetTableFilterPopover',
  components: {
    DualRangeSlider,
  },
  props: {
    fields: {
      type: Array,
      default: () => [],
    },
    filters: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ['update-range', 'toggle-categorical', 'clear-field'],
  data() {
    return {
      activeFieldKey: this.fields[0]?.key || '',
    }
  },
  computed: {
    activeField() {
      return this.fields.find((field) => field.key === this.activeFieldKey) || this.fields[0] || null
    },
    activeRange() {
      if (!this.activeField?.range) {
        return { min: 0, max: 0 }
      }

      const current = this.filters[this.activeField.key] || {}
      return {
        min: normalizeRangeValue(current.min, this.activeField.range.min),
        max: normalizeRangeValue(current.max, this.activeField.range.max),
      }
    },
  },
  watch: {
    fields: {
      immediate: true,
      handler(nextFields) {
        if (!nextFields.length) {
          this.activeFieldKey = ''
          return
        }

        if (!nextFields.some((field) => field.key === this.activeFieldKey)) {
          this.activeFieldKey = nextFields[0].key
        }
      },
    },
  },
  methods: {
    formatNumber(value) {
      const numeric = Number(value)
      if (!Number.isFinite(numeric)) return '0'
      return Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(1)
    },
    isFieldActive(key) {
      const filter = this.filters[key]

      if (!filter) {
        return false
      }

      if (Array.isArray(filter.selectedValues)) {
        return filter.selectedValues.length > 0
      }

      return Number.isFinite(filter.min) || Number.isFinite(filter.max)
    },
    isOptionSelected(key, value) {
      return Boolean(this.filters[key]?.selectedValues?.includes(value))
    },
    toggleCategoricalValue(key, value) {
      this.$emit('toggle-categorical', { key, value })
    },
    handleRangeChange(key, nextRange) {
      this.$emit('update-range', {
        key,
        min: nextRange.min,
        max: nextRange.max,
      })
    },
  },
}
</script>

<style scoped>
.filter-popover {
  display: grid;
  grid-template-columns: 220px minmax(240px, 1fr);
  min-width: 520px;
  max-width: min(760px, calc(100vw - 64px));
  background: #fff;
  border: 1px solid #d5d9dd;
  border-radius: 10px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.filter-popover__list {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  background: #f8fafc;
  max-height: 360px;
  overflow: auto;
}

.filter-popover__field-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid #e5e7eb;
  background: transparent;
  font-size: 12px;
  text-align: left;
  color: #1f2933;
}

.filter-popover__field-btn.active,
.filter-popover__field-btn:hover,
.filter-popover__field-btn:focus-visible {
  background: #fff;
}

.filter-popover__field-state {
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
}

.filter-popover__detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  min-height: 280px;
}

.filter-popover__detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.filter-popover__clear-btn {
  padding: 0;
  font-size: 12px;
  text-decoration: none;
}

.filter-popover__options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow: auto;
  padding-right: 4px;
}

.filter-popover__option {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #334155;
}

.filter-popover__option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-popover__option-count {
  color: #64748b;
}

.filter-popover__range-panel {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-popover__range-values,
.filter-popover__range-limits {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #334155;
}

</style>
