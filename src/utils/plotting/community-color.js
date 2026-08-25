// Color handling for the community comparison plot.
//
// Two color models are needed. Categorical variables get a qualitative palette
// wide enough for the largest real case (a strain survey carries 30 levels).
// Numeric variables get a perceptually ordered continuous scale, so that
// binned levels read as a ramp rather than as unrelated categories.

// Qualitative palette, ordered so that adjacent entries stay distinguishable.
const CATEGORICAL_PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
  '#393b79', '#637939', '#8c6d31', '#843c39', '#7b4173',
  '#3182bd', '#e6550d', '#31a354', '#756bb1', '#636363',
]

// Viridis, matching the ambient-temperature colorbar in the reference figures.
const CONTINUOUS_STOPS = [
  [0.0, [68, 1, 84]],
  [0.1, [72, 40, 120]],
  [0.2, [62, 74, 137]],
  [0.3, [49, 104, 142]],
  [0.4, [38, 130, 142]],
  [0.5, [31, 158, 137]],
  [0.6, [53, 183, 121]],
  [0.7, [110, 206, 88]],
  [0.8, [181, 222, 43]],
  [1.0, [253, 231, 37]],
]

export const CONTINUOUS_COLORSCALE = CONTINUOUS_STOPS.map(([stop, [r, g, b]]) => [
  stop,
  `rgb(${r},${g},${b})`,
])

export function categoricalColor(index) {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]
}

// Sample the continuous scale at a normalized position.
export function continuousColor(position) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(position) ? position : 0))

  for (let index = 1; index < CONTINUOUS_STOPS.length; index += 1) {
    const [upperStop, upperRGB] = CONTINUOUS_STOPS[index]

    if (clamped > upperStop) {
      continue
    }

    const [lowerStop, lowerRGB] = CONTINUOUS_STOPS[index - 1]
    const span = upperStop - lowerStop
    const ratio = span ? (clamped - lowerStop) / span : 0
    const channels = lowerRGB.map((value, channel) =>
      Math.round(value + (upperRGB[channel] - value) * ratio),
    )

    return `rgb(${channels[0]},${channels[1]},${channels[2]})`
  }

  const [, last] = CONTINUOUS_STOPS[CONTINUOUS_STOPS.length - 1]
  return `rgb(${last[0]},${last[1]},${last[2]})`
}

// Colors for an ordered set of discrete levels. Numeric levels are spread along
// the continuous scale so their order stays visible; categorical levels take
// the qualitative palette, where order carries no meaning.
export function buildSeriesColors(labels = [], { ordered = false } = {}) {
  const colors = new Map()

  if (ordered && labels.length > 1) {
    labels.forEach((label, index) => {
      colors.set(label, continuousColor(index / (labels.length - 1)))
    })

    return colors
  }

  labels.forEach((label, index) => {
    colors.set(label, ordered ? continuousColor(0.5) : categoricalColor(index))
  })

  return colors
}

export function withAlpha(color, alpha) {
  const rgbMatch = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color)

  if (rgbMatch) {
    return `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${alpha})`
  }

  const hexMatch = /^#([0-9a-f]{6})$/i.exec(color)

  if (hexMatch) {
    const value = Number.parseInt(hexMatch[1], 16)
    /* eslint-disable no-bitwise */
    return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`
    /* eslint-enable no-bitwise */
  }

  return color
}
