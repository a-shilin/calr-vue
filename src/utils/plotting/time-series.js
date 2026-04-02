// Time-series plot rendering.
// This file takes analysis-ready rows, applies time-series-specific shaping,
// and produces Plotly traces/layout for the analysis time plot.
import { aggregateDetailRows, applyDefaultOutlierRemoval } from '../process'
import { axisTitle, renderPlot, resolveGroupColor } from './core'

function smoothValues(values, windowSize) {
  if (!windowSize || windowSize <= 1) {
    return values
  }

  const halfWindow = Math.floor(windowSize / 2)

  return values.map((_, index) => {
    let sum = 0
    let count = 0

    for (let cursor = index - halfWindow; cursor <= index + halfWindow; cursor += 1) {
      if (cursor >= 0 && cursor < values.length && values[cursor] !== null && !Number.isNaN(values[cursor])) {
        sum += values[cursor]
        count += 1
      }
    }

    return count ? sum / count : null
  })
}

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

function buildFiniteSeries(xValues, yValues) {
  const x = []
  const y = []

  for (let index = 0; index < xValues.length; index += 1) {
    const xValue = xValues[index]
    const yValue = yValues[index]

    if (
      xValue === null
      || yValue === null
      || Number.isNaN(xValue)
      || Number.isNaN(yValue)
    ) {
      continue
    }

    x.push(xValue)
    y.push(yValue)
  }

  return { x, y }
}

function buildTimeSeriesDataset(rows) {
  return {
    groupedRows: aggregateDetailRows(rows, { per: 'min', grp: true }),
    subjectRows: aggregateDetailRows(rows, { per: 'min', grp: false }),
  }
}

function computeLightDarkShading(rows) {
  const subject = rows[0]?.['subject.id']
  const subjectRows = rows
    .filter((row) => row['subject.id'] === subject)
    .sort((left, right) => left['exp.minute'] - right['exp.minute'])

  const segments = []
  let current = null

  subjectRows.forEach((row) => {
    const isDark = Number(row.light) === 0

    if (isDark && !current) {
      current = { start: row['exp.minute'] }
    }

    if (!isDark && current) {
      current.end = row['exp.minute']
      segments.push(current)
      current = null
    }
  })

  if (current && subjectRows.length) {
    current.end = subjectRows[subjectRows.length - 1]['exp.minute']
    segments.push(current)
  }

  return segments
}

export async function renderTimeSeriesPlot(target, analysisData, options, explorerVariables) {
  const rows = analysisData?.rows || []
  const session = analysisData?.session || {}

  if (!target || !rows.length) {
    return
  }

  const yLabel = explorerVariables.find((item) => item.field === options.yVar)?.label || options.yVar
  const filteredRows = options.removeOutliers ? applyDefaultOutlierRemoval(rows) : rows
  const timeRangeRows = filteredRows.filter((row) => row['exp.minute'] >= options.rangeStart * 60 && row['exp.minute'] <= options.rangeEnd * 60)
  const { groupedRows, subjectRows } = buildTimeSeriesDataset(timeRangeRows)
  const groups = resolveGroupOrder(groupedRows, options.groupOrder || session?.groupNames || [])
  const traces = []

  if (options.showIndividuals) {
    const subjects = {}

    subjectRows.forEach((row) => {
      const subjectId = row['subject.id']
      if (!subjects[subjectId]) {
        subjects[subjectId] = []
      }
      subjects[subjectId].push(row)
    })

    Object.values(subjects).forEach((subjectSeries) => {
      subjectSeries.sort((left, right) => left['exp.minute'] - right['exp.minute'])
      const groupName = subjectSeries[0]?.groupName || 'Unknown'
      const color = resolveGroupColor(groupName, options.groupColors, subjectSeries[0]?.color || '#888')

      traces.push({
        x: subjectSeries.map((row) => row['exp.minute'] / 60),
        y: subjectSeries.map((row) => row[options.yVar]),
        mode: 'lines',
        line: {
          color,
          width: 0.5,
        },
        name: `${groupName} (individual)`,
        hoverinfo: 'none',
        showlegend: false,
        type: 'scatter',
      })
    })
  }

  if (options.showMean) {
    groups.forEach((groupName) => {
      const groupSeries = groupedRows
        .filter((row) => row.groupName === groupName)
        .sort((left, right) => left['exp.minute'] - right['exp.minute'])

      if (!groupSeries.length) {
        return
      }

      const color = resolveGroupColor(groupName, options.groupColors, groupSeries[0]?.color || '#888')
      const xHours = groupSeries.map((row) => row['exp.minute'] / 60)
      const meanValues = groupSeries.map((row) => row[`${options.yVar}.x`] ?? null)
      const semLower = meanValues.map((value, index) => {
        const semValue = groupSeries[index]?.[`${options.yVar}.y`] ?? null
        return value === null || semValue === null ? null : value - semValue
      })
      const semUpper = meanValues.map((value, index) => {
        const semValue = groupSeries[index]?.[`${options.yVar}.y`] ?? null
        return value === null || semValue === null ? null : value + semValue
      })
      const windowSize = options.smoothing ? options.smoothWindow : 1
      const smoothedMean = smoothValues(meanValues, windowSize)
      const smoothedLower = smoothValues(semLower, windowSize)
      const smoothedUpper = smoothValues(semUpper, windowSize)
      const meanSeries = buildFiniteSeries(xHours, smoothedMean)
      const lowerSeries = buildFiniteSeries(xHours, smoothedLower)
      const upperSeries = buildFiniteSeries(xHours, smoothedUpper)

      if (!meanSeries.x.length) {
        return
      }

      if (lowerSeries.x.length && upperSeries.x.length) {
        traces.push({
          x: lowerSeries.x,
          y: lowerSeries.y,
          line: { width: 0 },
          hoverinfo: 'skip',
          fillcolor: hexToRGBA(color, 0.2),
          showlegend: false,
          name: `${groupName} (SEM lower)`,
          type: 'scatter',
          connectgaps: false,
        })

        traces.push({
          x: upperSeries.x,
          y: upperSeries.y,
          fill: 'tonexty',
          line: { width: 0 },
          fillcolor: hexToRGBA(color, 0.2),
          hoverinfo: 'skip',
          showlegend: false,
          name: `${groupName} (SEM ribbon)`,
          type: 'scatter',
          connectgaps: false,
        })
      }

      traces.push({
        x: meanSeries.x,
        y: meanSeries.y,
        mode: 'lines',
        line: {
          color,
          width: 2,
        },
        name: groupName,
        type: 'scatter',
        connectgaps: false,
      })
    })
  }

  await renderPlot(
    target,
    traces,
    {
      margin: { t: 20, r: 20, b: 70, l: 90 },
      xaxis: {
        title: axisTitle('Time (hours)'),
        automargin: true,
        tickmode: 'linear',
        dtick: 12,
        ticks: 'inside',
        ticklen: 6,
        range: [options.rangeStart, options.rangeEnd],
        zeroline: false,
      },
      yaxis: {
        title: axisTitle(yLabel),
        automargin: true,
      },
      shapes: options.showDarkLight
        ? computeLightDarkShading(timeRangeRows).map((segment) => ({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            layer: 'below',
            x0: segment.start / 60,
            x1: segment.end / 60,
            y0: 0.01,
            y1: 1,
            fillcolor: 'rgba(180,180,180,0.2)',
            line: { width: 0 },
          }))
        : [],
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      showlegend: true,
      hovermode: 'x unified',
    },
    { responsive: true, displaylogo: false },
  )
}
