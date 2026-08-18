// Time-series plot rendering.
// This file takes analysis-ready rows, applies time-series-specific shaping,
// and produces Plotly traces/layout for the analysis time plot.
import { applyDefaultOutlierRemoval, isCumulativeVariable, rebaseCumulativeColumns } from '../process'
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

function mode(values) {
  if (!values.length) {
    return null
  }

  const counts = new Map()
  let bestValue = values[0]
  let bestCount = 0

  values.forEach((value) => {
    const count = (counts.get(value) || 0) + 1
    counts.set(value, count)

    if (count > bestCount) {
      bestCount = count
      bestValue = value
    }
  })

  return bestValue
}

function computeMinuteBin(rows) {
  const minutes = rows
    .map((row) => Number(row['exp.minute']))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)

  if (minutes.length < 2) {
    return 1
  }

  const diffs = []

  for (let index = 1; index < minutes.length; index += 1) {
    const diffMinutes = minutes[index] - minutes[index - 1]
    if (diffMinutes > 0) {
      diffs.push(diffMinutes)
    }
  }

  const modeDiffMinutes = mode(diffs)

  return modeDiffMinutes ? 60 / modeDiffMinutes : 1
}

function hexToRGBA(hex, alpha) {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function resolveTimeSeriesValue(row, variable, minuteBin) {
  const value = row[variable]

  if (variable === 'feed' && value !== null && value !== undefined && !Number.isNaN(value)) {
    return value * minuteBin
  }

  return value
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
  const startMinute = options.rangeStart * 60
  const croppedRows = filteredRows.filter((row) => row['exp.minute'] >= startMinute && row['exp.minute'] <= options.rangeEnd * 60)

  // Cumulative variables re-zero at the window start: the acclimation period
  // before it is intentionally discarded, so its intake/expenditure must not
  // carry into the analysis. The x-axis is rebased to match, so a window of
  // hours 18-89 plots as experimental hours 0-71. Rate variables are unaffected
  // and keep absolute file hours.
  const isCumulative = isCumulativeVariable(options.yVar)
  const timeRangeRows = isCumulative
    ? rebaseCumulativeColumns(filteredRows, croppedRows, startMinute)
    : croppedRows
  const xOffset = isCumulative ? options.rangeStart : 0

  const minuteBin = computeMinuteBin(timeRangeRows)
  const groups = resolveGroupOrder(timeRangeRows, options.groupOrder || session?.groupNames || [])
  const traces = []

  if (options.showIndividuals) {
    const subjects = {}

    timeRangeRows.forEach((row) => {
      const subjectId = row['subject.id']
      if (!subjects[subjectId]) {
        subjects[subjectId] = []
      }
      subjects[subjectId].push(row)
    })

    Object.entries(subjects).forEach(([subjectId, subjectSeries]) => {
      subjectSeries.sort((left, right) => left['exp.minute'] - right['exp.minute'])
      const groupName = subjectSeries[0]?.groupName || 'Unknown'
      const color = resolveGroupColor(groupName, options.groupColors, subjectSeries[0]?.color || '#888')

      traces.push({
        x: subjectSeries.map((row) => (row['exp.minute'] / 60) - xOffset),
        y: subjectSeries.map((row) => resolveTimeSeriesValue(row, options.yVar, minuteBin)),
        // Carried per point so the tooltip can name the animal being hovered --
        // the whole reason to look at individual traces is to spot a flatlined or
        // erratic cage and identify which one to exclude.
        customdata: subjectSeries.map((row) => [
          subjectId,
          groupName,
          row.day ?? row['exp.day'] ?? '',
        ]),
        mode: 'lines+markers',
        line: {
          color,
          width: 1,
        },
        marker: {
          color,
          size: 4,
        },
        name: `${subjectId}:${groupName}`,
        hovertemplate: [
          '<b>Subject ID:</b> %{customdata[0]}',
          '<b>Group:</b> %{customdata[1]}',
          `<b>${yLabel}:</b> %{y}`,
          '<b>Time (hours):</b> %{x}',
          '<b>Circadian Cycle:</b> %{customdata[2]}',
          '<extra></extra>',
        ].join('<br>'),
        showlegend: true,
        type: 'scatter',
      })
    })
  }

  if (options.showMean) {
    groups.forEach((groupName) => {
      const groupSeries = timeRangeRows
        .filter((row) => row.groupName === groupName)
        .sort((left, right) => left['exp.minute'] - right['exp.minute'])

      if (!groupSeries.length) {
        return
      }

      const color = resolveGroupColor(groupName, options.groupColors, groupSeries[0]?.color || '#888')
      const byMinute = {}

      groupSeries.forEach((row) => {
        const minute = Math.round(row['exp.minute'])
        const value = resolveTimeSeriesValue(row, options.yVar, minuteBin)

        if (minute === null || minute === undefined || value === null || value === undefined || Number.isNaN(value)) {
          return
        }

        if (!byMinute[minute]) {
          byMinute[minute] = []
        }

        byMinute[minute].push(value)
      })

      const minutes = Object.keys(byMinute)
        .map((value) => Number.parseInt(value, 10))
        .sort((left, right) => left - right)

      const xHours = minutes.map((minute) => (minute / 60) - xOffset)
      const meanValues = []
      const semLower = []
      const semUpper = []

      minutes.forEach((minute) => {
        const values = byMinute[minute].filter((value) => value !== null && value !== undefined && !Number.isNaN(value))

        if (!values.length) {
          meanValues.push(null)
          semLower.push(null)
          semUpper.push(null)
          return
        }

        const avg = values.reduce((sum, value) => sum + value, 0) / values.length

        if (values.length === 1) {
          meanValues.push(avg)
          semLower.push(avg)
          semUpper.push(avg)
          return
        }

        const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
        const sem = Math.sqrt(variance) / Math.sqrt(values.length)

        meanValues.push(avg)
        semLower.push(avg - sem)
        semUpper.push(avg + sem)
      })

      const windowSize = options.smoothing ? options.smoothWindow : 1
      const smoothedMean = smoothValues(meanValues, windowSize)
      const smoothedLower = smoothValues(semLower, windowSize)
      const smoothedUpper = smoothValues(semUpper, windowSize)

      traces.push({
        x: xHours,
        y: smoothedLower,
        line: { width: 0 },
        hoverinfo: 'skip',
        fillcolor: hexToRGBA(color, 0.2),
        showlegend: false,
        name: `${groupName} (SEM lower)`,
        type: 'scatter',
      })

      traces.push({
        x: xHours,
        y: smoothedUpper,
        fill: 'tonexty',
        line: { width: 0 },
        fillcolor: hexToRGBA(color, 0.2),
        hoverinfo: 'skip',
        showlegend: false,
        name: `${groupName} (SEM ribbon)`,
        type: 'scatter',
      })

      traces.push({
        x: xHours,
        y: smoothedMean,
        mode: 'lines',
        line: {
          color,
          width: 2,
        },
        name: groupName,
        // Needed once individuals are shown: 'closest' hover would otherwise fall
        // back to Plotly's default label for this trace.
        hovertemplate: [
          `<b>Group:</b> ${groupName}`,
          `<b>${yLabel} (mean):</b> %{y}`,
          '<b>Time (hours):</b> %{x}',
          '<extra></extra>',
        ].join('<br>'),
        type: 'scatter',
      })
    })
  }

  await renderPlot(
    target,
    traces,
    {
      margin: { t: 20, r: 20, b: 70, l: 90 },
      xaxis: {
        title: axisTitle(isCumulative ? 'Experimental Time (hours)' : 'Time (hours)'),
        automargin: true,
        tickmode: 'linear',
        dtick: 12,
        ticks: 'inside',
        ticklen: 6,
        range: [options.rangeStart - xOffset, options.rangeEnd - xOffset],
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
            x0: (segment.start / 60) - xOffset,
            x1: (segment.end / 60) - xOffset,
            y0: 0.01,
            y1: 1,
            fillcolor: 'rgba(180,180,180,0.2)',
            line: { width: 0 },
          }))
        : [],
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      showlegend: true,
      // Pinned: Plotly silently defaults traceorder to 'reversed' when a figure
      // contains filled-area traces (the SEM ribbons here), which would list the
      // groups backwards relative to every other plot.
      legend: { traceorder: 'normal' },
      // 'x unified' stacks every trace into one label, which is unusable with a
      // cage per trace -- switch to per-point hovering when individuals are on.
      hovermode: options.showIndividuals ? 'closest' : 'x unified',
      hoverdistance: 20,
      hoverlabel: { namelength: -1 },
    },
    { responsive: true, displaylogo: false },
  )
}
