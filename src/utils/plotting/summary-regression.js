// Community summary regression rendering.
// This file takes summary rows from the community dataset browser and builds
// the comparison scatter/regression plot for selected experiments.
import { axisTitle, renderPlot } from './core'

function computeOLS(x, y) {
  const n = x.length
  const meanX = x.reduce((sum, value) => sum + value, 0) / n
  const meanY = y.reduce((sum, value) => sum + value, 0) / n

  let numerator = 0
  let denominator = 0

  for (let index = 0; index < n; index += 1) {
    numerator += (x[index] - meanX) * (y[index] - meanY)
    denominator += (x[index] - meanX) ** 2
  }

  const slope = numerator / denominator
  const intercept = meanY - slope * meanX
  const predicted = x.map((value) => slope * value + intercept)
  const residualSum = y.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0)
  const totalSum = y.reduce((sum, value) => sum + (value - meanY) ** 2, 0)

  return {
    slope,
    intercept,
    r2: 1 - residualSum / totalSum,
  }
}

export async function renderSummaryRegressionPlot(target, rows, options) {
  if (!target || !rows.length) {
    return
  }

  const allSelected = new Set([...options.selectedExperiments, ...options.highlightedExperiments])
  const filteredRows = rows.filter((row) => allSelected.has(row.experiment_id))
  const { xVar, yVar, groupVar } = options
  const highlighting = options.highlightedExperiments.length > 0
  const groups = {}

  filteredRows.forEach((row) => {
    const groupValue = row[groupVar] || 'Unknown'
    if (!groups[groupValue]) {
      groups[groupValue] = { highlighted: [], normal: [] }
    }

    if (options.highlightedExperiments.includes(row.experiment_id)) {
      groups[groupValue].highlighted.push(row)
    } else {
      groups[groupValue].normal.push(row)
    }
  })

  const palette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
  const groupNames = Object.keys(groups)
  const colorMap = {}

  groupNames.forEach((groupName, index) => {
    colorMap[groupName] = palette[index % palette.length]
  })

  const normalGroupNames = groupNames.filter((g) => groups[g].normal.length > 0)
  const highlightedGroupNames = groupNames.filter((g) => groups[g].highlighted.length > 0)

  const legendTraces = []
  const normalScatter = []
  const highlightedScatter = []
  const referenceLines = []
  const highlightedLines = []

  normalGroupNames.forEach((groupName, index) => {
    const color = colorMap[groupName]
    legendTraces.push({
      x: [null],
      y: [null],
      mode: 'markers',
      type: 'scatter',
      name: groupName,
      legendgroup: `all_${groupName}`,
      legendgrouptitle: highlighting && index === 0 ? { text: 'Group A' } : undefined,
      marker: highlighting
        ? { color: '#FFFFFF', size: 10, line: { width: 2, color } }
        : { color, size: 10 },
      showlegend: true,
      hoverinfo: 'skip',
    })
  })

  if (highlighting) {
    highlightedGroupNames.forEach((groupName, index) => {
      const color = colorMap[groupName]
      legendTraces.push({
        x: [null],
        y: [null],
        mode: 'markers',
        type: 'scatter',
        name: groupName,
        legendgroup: `compare_${groupName}`,
        legendgrouptitle: index === 0 ? { text: 'Group B' } : undefined,
        marker: { color, size: 10 },
        showlegend: true,
        hoverinfo: 'skip',
      })
    })
  }

  groupNames.forEach((groupName) => {
    const color = colorMap[groupName]
    const highlightedRows = groups[groupName].highlighted
    const normalRows = groups[groupName].normal

    normalRows.forEach((row) => {
      normalScatter.push({
        x: [row[xVar]],
        y: [row[yVar]],
        mode: 'markers',
        type: 'scatter',
        legendgroup: `all_${groupName}`,
        marker: {
          color: highlighting ? '#FFFFFF' : color,
          size: highlighting ? 3 : 6,
          opacity: 1,
          line: highlighting ? { width: 1, color } : { width: 0 },
        },
        hovertemplate:
          `<b>${groupVar}: ${groupName}</b><br>` +
          `<b>${xVar}:</b> %{x:.3f}<br>` +
          `<b>${yVar}:</b> %{y:.3f}<br>` +
          `<b>Experiment:</b> ${row.experiment_id}<extra></extra>`,
        showlegend: false,
      })
    })

    highlightedRows.forEach((row) => {
      highlightedScatter.push({
        x: [row[xVar]],
        y: [row[yVar]],
        mode: 'markers',
        type: 'scatter',
        legendgroup: `compare_${groupName}`,
        marker: {
          color,
          size: 7,
          opacity: 1,
          line: { width: 0 },
        },
        hovertemplate:
          `<b>${groupVar}: ${groupName}</b><br>` +
          `<b>${xVar}:</b> %{x:.3f}<br>` +
          `<b>${yVar}:</b> %{y:.3f}<br>` +
          `<b>Experiment:</b> ${row.experiment_id}<extra></extra>`,
        showlegend: false,
      })
    })

    if (normalRows.length > 1) {
      const xs = normalRows.map((row) => row[xVar])
      const ys = normalRows.map((row) => row[yVar])
      const { slope, intercept } = computeOLS(xs, ys)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)

      referenceLines.push({
        x: [minX, maxX],
        y: [slope * minX + intercept, slope * maxX + intercept],
        mode: 'lines',
        type: 'scatter',
        legendgroup: `all_${groupName}`,
        line: { color, width: 1 },
        hoverinfo: 'skip',
        showlegend: false,
      })
    }

    if (highlightedRows.length > 1) {
      const xs = highlightedRows.map((row) => row[xVar])
      const ys = highlightedRows.map((row) => row[yVar])
      const { slope, intercept } = computeOLS(xs, ys)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)

      highlightedLines.push({
        x: [minX, maxX],
        y: [slope * minX + intercept, slope * maxX + intercept],
        mode: 'lines',
        type: 'scatter',
        legendgroup: `compare_${groupName}`,
        line: { color, width: 4 },
        hoverinfo: 'skip',
        showlegend: false,
      })
    }
  })

  await renderPlot(
    target,
    [
      ...legendTraces,
      ...normalScatter,
      ...highlightedScatter,
      ...referenceLines,
      ...highlightedLines,
    ],
    {
      margin: { l: 90, r: 20, t: 30, b: 70 },
      xaxis: {
        title: axisTitle(xVar),
        automargin: true,
        ...(options.axisRanges ? { range: options.axisRanges.xRange } : {}),
      },
      yaxis: {
        title: axisTitle(yVar),
        automargin: true,
        ...(options.axisRanges ? { range: options.axisRanges.yRange } : {}),
      },
      hovermode: 'closest',
      showlegend: true,
      legend: { tracegroupgap: 0 },
    },
    { responsive: true, displaylogo: false },
  )
}
