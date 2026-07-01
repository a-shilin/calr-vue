<template>
  <div class="dual-range-slider">
    <div class="dual-range-slider__track"></div>
    <div class="dual-range-slider__active" :style="activeRangeStyle"></div>

    <input
      class="dual-range-slider__input dual-range-slider__input--min"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="safeValue.min"
      @input="handleMinInput"
    />
    <input
      class="dual-range-slider__input dual-range-slider__input--max"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="safeValue.max"
      @input="handleMaxInput"
    />
  </div>
</template>

<script>
function normalizeNumeric(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export default {
  name: 'DualRangeSlider',
  props: {
    min: {
      type: Number,
      required: true,
    },
    max: {
      type: Number,
      required: true,
    },
    step: {
      type: Number,
      default: 1,
    },
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  computed: {
    safeValue() {
      const minValue = normalizeNumeric(this.modelValue?.min, this.min)
      const maxValue = normalizeNumeric(this.modelValue?.max, this.max)

      return {
        min: Math.max(this.min, Math.min(minValue, maxValue)),
        max: Math.min(this.max, Math.max(maxValue, minValue)),
      }
    },
    span() {
      return this.max - this.min || 1
    },
    activeRangeStyle() {
      const start = ((this.safeValue.min - this.min) / this.span) * 100
      const end = ((this.safeValue.max - this.min) / this.span) * 100

      return {
        left: `${start}%`,
        width: `${Math.max(0, end - start)}%`,
      }
    },
  },
  methods: {
    handleMinInput(event) {
      const nextMin = Math.min(Number(event.target.value), this.safeValue.max)
      this.$emit('update:modelValue', {
        min: nextMin,
        max: this.safeValue.max,
      })
    },
    handleMaxInput(event) {
      const nextMax = Math.max(Number(event.target.value), this.safeValue.min)
      this.$emit('update:modelValue', {
        min: this.safeValue.min,
        max: nextMax,
      })
    },
  },
}
</script>

<style scoped>
.dual-range-slider {
  position: relative;
  height: 28px;
}

.dual-range-slider__track,
.dual-range-slider__active {
  position: absolute;
  top: 50%;
  height: 6px;
  border-radius: 999px;
  transform: translateY(-50%);
}

.dual-range-slider__track {
  left: 0;
  right: 0;
  background: #d5d9dd;
}

.dual-range-slider__active {
  background: #475569;
}

.dual-range-slider__input {
  position: absolute;
  inset: 0;
  margin: 0;
  width: 100%;
  background: transparent;
  pointer-events: none;
  appearance: none;
  -webkit-appearance: none;
}

.dual-range-slider__input::-webkit-slider-runnable-track {
  height: 28px;
  background: transparent;
}

.dual-range-slider__input::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  margin-top: 6px;
  border: 2px solid #334155;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
  cursor: pointer;
  pointer-events: auto;
}

.dual-range-slider__input::-moz-range-track {
  height: 28px;
  background: transparent;
}

.dual-range-slider__input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 2px solid #334155;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
  cursor: pointer;
  pointer-events: auto;
}
</style>
