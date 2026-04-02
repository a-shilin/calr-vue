// Shared Plotly helpers.
// This file owns Plotly module loading, common axis-title formatting, and
// explicit plot cleanup so individual renderer modules stay smaller.
let plotlyPromise = null

export async function getPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js-cartesian-dist-min').then((module) => module.default)
  }

  return plotlyPromise
}

export async function renderPlot(target, traces, layout, config) {
  const Plotly = await getPlotly()
  await Plotly.react(target, traces, layout, config)
}

export async function purgePlot(target) {
  if (!target) {
    return
  }

  const Plotly = await getPlotly()
  await Plotly.purge(target)
}

export function axisTitle(text) {
  return {
    text,
    standoff: 12,
    font: {
      size: 16,
    },
  }
}

export function resolveGroupColor(groupName, groupColors = {}, fallbackColor = '#888') {
  return groupColors[groupName] || fallbackColor
}
