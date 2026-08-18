// Regression plot rendering.
// This file takes analysis-ready rows, derives regression inputs for the
// selected covariate/response pair, and builds the Plotly regression plot.
import { aggregateDetailRows, applyDefaultOutlierRemoval, cropDetailRows } from '../process'
import { axisTitle, renderPlot, resolveGroupColor } from './core'

function hexToRGBA(hex, alpha) {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function resolveGroupOrder(rows, preferredOrder = []) {
  const seen = new Set()
  const ordered = []

  preferredOrder.forEach((groupName) => {
    if (groupName && !seen.has(groupName)) {
      seen.add(groupName)
      ordered.push(groupName)
    }
  })

  rows.forEach((row) => {
    const groupName = row.groupName
    if (groupName && !seen.has(groupName)) {
      seen.add(groupName)
      ordered.push(groupName)
    }
  })

  return ordered
}

function toNullableNumber(value) {
  if (value === null || value === undefined || `${value}`.trim?.() === '' || `${value}`.trim?.().toUpperCase() === 'NA') {
    return null
  }

  const number = Number(value)
  return Number.isNaN(number) ? null : number
}

function mean(values) {
  if (!values.length) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function buildRegressionDataset(rows, {
  xVar,
  yVar,
  period = 'Total',
  removeOutliers = true,
  hourRange = null,
} = {}) {
  if (!Array.isArray(rows) || !rows.length || !xVar || !yVar) {
    return []
  }

  let sourceRows = rows

  if (Array.isArray(hourRange) && hourRange.length === 2) {
    sourceRows = cropDetailRows(sourceRows, hourRange)
  }

  const subjectMetadata = new Map()
  sourceRows.forEach((row) => {
    const subjectId = row['subject.id']
    if (!subjectId || subjectMetadata.has(subjectId)) {
      return
    }

    subjectMetadata.set(subjectId, {
      subjectSession: row.subjectSession || {},
      row,
    })
  })

  const outlierHandledRows = removeOutliers ? applyDefaultOutlierRemoval(sourceRows) : sourceRows
  const per = period === 'Total' ? 'hour' : 'light'
  let aggregatedRows = aggregateDetailRows(outlierHandledRows, {
    per,
    grp: false,
    variables: [...new Set([xVar, yVar])],
  })

  if (period === 'Light') {
    aggregatedRows = aggregatedRows.filter((row) => Number(row.light) === 1)
  } else if (period === 'Dark') {
    aggregatedRows = aggregatedRows.filter((row) => Number(row.light) === 0)
  }

  const subjectRows = new Map()
  const getRegressionCovariateValue = (row) => {
    const metadata = subjectMetadata.get(row['subject.id'])
    const subjectSession = metadata?.subjectSession || {}
    const sourceRow = metadata?.row || row

    if (xVar === 'subject.mass') {
      return toNullableNumber(subjectSession.total_mass ?? sourceRow['subject.mass'])
    }

    if (xVar === 'subject.lean.mass') {
      return toNullableNumber(subjectSession.lean_mass ?? sourceRow['subject.lean.mass'])
    }

    if (xVar === 'subject.fat.mass') {
      return toNullableNumber(subjectSession.fat_mass ?? sourceRow['subject.fat.mass'])
    }

    return toNullableNumber(row[xVar])
  }

  aggregatedRows.forEach((row) => {
    const subjectId = row['subject.id']
    const xValue = getRegressionCovariateValue(row)
    const yValue = toNullableNumber(row[yVar])

    if (!subjectId || xValue === null || yValue === null) {
      return
    }

    if (!subjectRows.has(subjectId)) {
      subjectRows.set(subjectId, {
        'subject.id': subjectId,
        groupName: row.groupName || 'Unknown',
        color: row.color || '#888',
        xValues: [],
        yValues: [],
      })
    }

    const subjectEntry = subjectRows.get(subjectId)
    subjectEntry.xValues.push(xValue)
    subjectEntry.yValues.push(yValue)
  })

  return [...subjectRows.values()]
    .map((row) => ({
      'subject.id': row['subject.id'],
      groupName: row.groupName,
      color: row.color,
      x: mean(row.xValues),
      y: mean(row.yValues),
    }))
    .filter((row) => row.x !== null && row.y !== null && !Number.isNaN(row.x) && !Number.isNaN(row.y))
    .sort((left, right) => {
      const groupDiff = String(left.groupName).localeCompare(String(right.groupName))
      if (groupDiff) {
        return groupDiff
      }

      return String(left['subject.id']).localeCompare(String(right['subject.id']))
    })
}

function computeOLS(xValues, yValues) {
  const count = xValues.length

  if (count < 2) {
    return null
  }

  const meanX = xValues.reduce((sum, value) => sum + value, 0) / count
  const meanY = yValues.reduce((sum, value) => sum + value, 0) / count

  let numerator = 0
  let denominator = 0
  let totalSumSquares = 0

  for (let index = 0; index < count; index += 1) {
    numerator += (xValues[index] - meanX) * (yValues[index] - meanY)
    denominator += (xValues[index] - meanX) ** 2
    totalSumSquares += (yValues[index] - meanY) ** 2
  }

  if (!denominator) {
    return null
  }

  const slope = numerator / denominator
  const intercept = meanY - slope * meanX
  const predicted = xValues.map((value) => slope * value + intercept)
  const residualSumSquares = yValues.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0)

  return {
    slope,
    intercept,
    r2: totalSumSquares ? 1 - residualSumSquares / totalSumSquares : 1,
  }
}

function computeConstantBand(xValues, yValues, slope, intercept) {
  if (xValues.length <= 2) {
    return null
  }

  const residualSumSquares = yValues.reduce((sum, value, index) => {
    const predicted = xValues[index] * slope + intercept
    return sum + (value - predicted) ** 2
  }, 0)

  return {
    se: Math.sqrt(residualSumSquares / (xValues.length - 2)),
    t: 1.96,
  }
}

export async function renderRegressionPlot(target, analysisData, options = {}) {
  const rows = analysisData?.rows || []

  if (!target || !rows.length) {
    return
  }

  const regressionRows = buildRegressionDataset(rows, options)

  if (!regressionRows.length) {
    return
  }

  const xLabel = options.xLabel || options.xVar
  const yLabel = options.yLabel || options.yVar
  const groups = resolveGroupOrder(regressionRows, options.groupOrder || analysisData?.session?.groupNames || [])
  const traces = []

  groups.forEach((groupName) => {
    const groupRows = regressionRows.filter((row) => row.groupName === groupName)

    if (!groupRows.length) {
      return
    }

    traces.push({
      x: groupRows.map((row) => row.x),
      y: groupRows.map((row) => row.y),
      mode: 'markers',
      type: 'scatter',
      name: groupName,
      marker: {
        color: resolveGroupColor(groupName, options.groupColors, groupRows[0].color),
        size: 10,
        opacity: 0.9,
      },
      customdata: groupRows.map((row) => ({
        subjectId: row['subject.id'],
        groupName: row.groupName,
      })),
      hovertemplate:
        '<b>Subject:</b> %{customdata.subjectId}<br>' +
        `<b>${xLabel}:</b> %{x:.4f}<br>` +
        `<b>${yLabel}:</b> %{y:.4f}<br>` +
        '<b>Group:</b> %{customdata.groupName}<extra></extra>',
    })

    const xValues = groupRows.map((row) => row.x)
    const yValues = groupRows.map((row) => row.y)
    const fit = computeOLS(xValues, yValues)

    if (!fit) {
      return
    }

    const minX = Math.min(...xValues)
    const maxX = Math.max(...xValues)
    const lineX = [minX, maxX]
    const lineY = lineX.map((value) => fit.slope * value + fit.intercept)

    if (options.showCI) {
      const band = computeConstantBand(xValues, yValues, fit.slope, fit.intercept)

      if (band) {
        traces.push({
          x: lineX,
          y: lineY.map((value) => value - band.t * band.se),
          mode: 'lines',
          line: { width: 0 },
          hoverinfo: 'skip',
          showlegend: false,
          type: 'scatter',
        })

        traces.push({
          x: lineX,
          y: lineY.map((value) => value + band.t * band.se),
          mode: 'lines',
          fill: 'tonexty',
          fillcolor: hexToRGBA(resolveGroupColor(groupName, options.groupColors, groupRows[0].color), 0.2),
          line: { width: 0 },
          hoverinfo: 'skip',
          showlegend: false,
          type: 'scatter',
        })
      }
    }

    traces.push({
      x: lineX,
      y: lineY,
      mode: 'lines',
      type: 'scatter',
      name: `R²=${fit.r2.toFixed(4)}`,
      line: {
        color: resolveGroupColor(groupName, options.groupColors, groupRows[0].color),
        width: 2,
      },
      hovertemplate:
        `<b>${groupName} OLS Regression</b><br>` +
        `Slope: ${fit.slope.toFixed(4)}<br>` +
        `Intercept: ${fit.intercept.toFixed(4)}<br>` +
        `R²: ${fit.r2.toFixed(4)}<extra></extra>`,
    })
  })

  await renderPlot(
    target,
    traces,
    {
      margin: { l: 90, r: 200, t: 30, b: 80 },
      xaxis: {
        title: axisTitle(`${xLabel} at Time of Day: ${options.period}`),
        automargin: true,
        zeroline: false,
      },
      yaxis: {
        title: axisTitle(yLabel),
        automargin: true,
        zeroline: false,
      },
      hovermode: 'closest',
      showlegend: true,
      // Pinned: Plotly silently defaults traceorder to 'reversed' when a figure
      // contains filled-area traces (the confidence bands here), which would list
      // the groups backwards relative to every other plot.
      legend: { traceorder: 'normal' },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
    },
    { responsive: true, displaylogo: false },
  )
}
