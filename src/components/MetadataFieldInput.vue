<template>
  <div class="metadata-field-input">
    <input
      v-if="field.type === 'readonly'"
      :value="displayValue"
      type="text"
      :placeholder="field.placeholder || ''"
      disabled
      readonly
    />
    <select
      v-else-if="field.type === 'select'"
      :value="displayValue"
      @change="updateValue($event.target.value)"
    >
      <option value="">{{ selectPlaceholder }}</option>
      <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
    </select>
    <div v-else-if="field.type === 'selectOrText'" class="metadata-field-input__stack">
      <select :value="selectOrTextMode" @change="handleSelectOrTextModeChange($event.target.value)">
        <option value="">{{ selectPlaceholder }}</option>
        <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
        <option value="__custom__">Other...</option>
      </select>
      <input
        v-if="selectOrTextMode === '__custom__'"
        :value="displayValue"
        type="text"
        :placeholder="customInputPlaceholder"
        @input="updateValue($event.target.value)"
      />
    </div>
    <input
      v-else
      :value="displayValue"
      :type="field.type === 'number' ? 'number' : 'text'"
      :step="field.step || null"
      :placeholder="field.placeholder || ''"
      @input="updateValue($event.target.value)"
    />
    <span v-if="field.helperText" class="metadata-field-input__helper">{{ field.helperText }}</span>
  </div>
</template>

<script>
const CUSTOM_VALUE = '__custom__'

export default {
  name: 'MetadataFieldInput',
  props: {
    field: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: [String, Number, Array],
      default: '',
    },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      customInputActive: false,
    }
  },
  computed: {
    displayValue() {
      if (Array.isArray(this.modelValue)) {
        return this.modelValue.join(', ')
      }

      return this.modelValue ?? ''
    },
    selectOrTextMode() {
      if (this.customInputActive) {
        return CUSTOM_VALUE
      }

      const value = `${this.displayValue}`.trim()
      if (!value) {
        return ''
      }

      return (this.field.options || []).includes(value) ? value : CUSTOM_VALUE
    },
    selectPlaceholder() {
      return `Select ${this.field.label}`
    },
    customInputPlaceholder() {
      return `Enter ${this.field.label}`
    },
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(value) {
        const displayValue = Array.isArray(value) ? value.join(', ') : `${value ?? ''}`.trim()
        this.customInputActive = Boolean(displayValue) && !(this.field.options || []).includes(displayValue)
      },
    },
  },
  methods: {
    updateValue(value) {
      this.$emit('update:modelValue', value)
    },
    handleSelectOrTextModeChange(value) {
      if (!value) {
        this.customInputActive = false
        this.updateValue('')
        return
      }

      if (value === CUSTOM_VALUE) {
        this.customInputActive = true
        if ((this.field.options || []).includes(this.displayValue)) {
          this.updateValue('')
        }
        return
      }

      this.customInputActive = false
      this.updateValue(value)
    },
  },
}
</script>

<style scoped>
.metadata-field-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metadata-field-input__stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metadata-field-input__helper {
  color: #667085;
  font-size: 12px;
}
</style>
