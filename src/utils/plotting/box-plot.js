// Box-plot rendering.
// This file takes analysis-ready rows, computes subject-level photoperiod
// averages, and builds the Plotly box plot configuration.
import { applyDefaultOutlierRemoval, cropDetailRows } from '../process'
import { axisTitle, renderPlot, resolveGroupColor } from './core'

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

function mean(values) {
  if (!values.length) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toNullableNumber(value) {
  if (value === null || value === undefined || `${value}`.trim?.() === '' || `${value}`.trim?.().toUpperCase() === 'NA') {
    return null
  }

  const number = Number(value)
  return Number.isNaN(number) ? null : number
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
    .map((row) => toNullableNumber(row['exp.minute']))
    .filter((value) => value !== null)
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

function computeSubjectBaselines(rows, variables) {
  const baselines = new Map()

  rows
    .slice()
    .sort((left, right) => {
      const minuteDiff = (toNullableNumber(left['exp.minute']) ?? 0) - (toNullableNumber(right['exp.minute']) ?? 0)
      if (minuteDiff) {
        return minuteDiff
      }

      return String(left['Date.Time'] || left['Time.Date'] || '').localeCompare(String(right['Date.Time'] || right['Time.Date'] || ''))
    })
    .forEach((row) => {
      const subjectId = row['subject.id']
      if (!subjectId) {
        return
      }

      if (!baselines.has(subjectId)) {
        baselines.set(subjectId, {})
      }

      const subjectBaselines = baselines.get(subjectId)
      variables.forEach((variable) => {
        if (subjectBaselines[variable] !== undefined) {
          return
        }

        const value = toNullableNumber(row[variable])
        if (value !== null) {
          subjectBaselines[variable] = value
        }
      })
    })

  return baselines
}

function resolveBoxPlotValue(row, variable, minuteBin, subjectBaselines) {
  const value = toNullableNumber(row[variable])

  if (value === null) {
    return null
  }

  if (['feed', 'drink'].includes(variable)) {
    return value * minuteBin
  }

  if (['pedmeter', 'allmeter'].includes(variable)) {
    return value - (subjectBaselines.get(row['subject.id'])?.[variable] ?? 0)
  }

  return value
}

export function buildBoxPlotDataset(rows, variable, options = {}) {
  if (!Array.isArray(rows) || !rows.length) {
    return []
  }

  const removeOutliers = options.removeOutliers ?? true
  const rangedRows = Array.isArray(options.hourRange) && options.hourRange.length === 2
    ? cropDetailRows(rows, options.hourRange)
    : rows
  const outlierHandledRows = removeOutliers ? applyDefaultOutlierRemoval(rangedRows) : rangedRows
  const minuteBin = computeMinuteBin(rangedRows)
  const subjectBaselines = computeSubjectBaselines(rangedRows, ['pedmeter', 'allmeter'])
  const subjectPeriods = new Map()

  outlierHandledRows.forEach((row) => {
    const subjectId = row['subject.id']
    const groupName = row.groupName || 'Unknown'
    const color = row.color || '#888'
    const baseKey = `${subjectId}::${groupName}`
    const periodBuckets = [
      { period: 'Total', include: true },
      { period: 'Dark', include: Number(row.light ?? (Number(row['enviro.light']) > 1 ? 1 : 0)) === 0 },
      { period: 'Light', include: Number(row.light ?? (Number(row['enviro.light']) > 1 ? 1 : 0)) === 1 },
    ]

    periodBuckets.forEach(({ period, include }) => {
      if (!include) {
        return
      }

      const key = `${baseKey}::${period}`
      const value = resolveBoxPlotValue(row, variable, minuteBin, subjectBaselines)

      if (value === null || Number.isNaN(value)) {
        return
      }

      if (!subjectPeriods.has(key)) {
        subjectPeriods.set(key, {
          period,
          groupName,
          color,
          subjectId,
          values: [],
        })
      }

      subjectPeriods.get(key).values.push(value)
    })
  })

  const periodOrder = ['Total', 'Dark', 'Light']
  const subjectEntries = [...subjectPeriods.values()]
    .map((entry) => ({
      period: entry.period,
      groupName: entry.groupName,
      color: entry.color,
      'subject.id': entry.subjectId,
      value: mean(entry.values),
    }))
    .filter((entry) => entry.value !== null && !Number.isNaN(entry.value))
  return subjectEntries.sort((left, right) => {
      const periodDiff = periodOrder.indexOf(left.period) - periodOrder.indexOf(right.period)
      if (periodDiff) {
        return periodDiff
      }

      const groupDiff = String(left.groupName).localeCompare(String(right.groupName))
      if (groupDiff) {
        return groupDiff
      }

      return String(left['subject.id']).localeCompare(String(right['subject.id']))
    })
}

export async function renderBoxPlot(target, analysisData, variable, options = {}) {
  const rows = analysisData?.rows || []

  if (!target) {
    return
  }

  const boxRows = buildBoxPlotDataset(rows, variable, {
    removeOutliers: options.removeOutliers,
    hourRange: options.hourRange,
  })

  const groups = resolveGroupOrder(boxRows, options.groupOrder || [])
  const traces = []

  groups.forEach((groupName) => {
    const groupRows = boxRows.filter((row) => row.groupName === groupName)
    const color = resolveGroupColor(groupName, options.groupColors, groupRows[0]?.color || '#888')

    traces.push({
      x: groupRows.map((row) => row.period),
      y: groupRows.map((row) => row.value),
      type: 'box',
      name: groupName,
      marker: { color },
      line: { color },
      offsetgroup: groupName,
      boxpoints: 'all',
      jitter: 0.3,
      pointpos: -1.8,
      whiskerwidth: 0.6,
      customdata: groupRows.map((row) => row['subject.id']),
      hovertemplate:
        '<b>Subject:</b> %{customdata}<br>' +
        '<b>Period:</b> %{x}<br>' +
        '<b>Value:</b> %{y}<extra></extra>',
      marker: {
        color,
        size: 5,
        opacity: 0.7,
      },
    })
  })

  await renderPlot(
    target,
    traces,
    {
      margin: { t: 20, r: 20, b: 70, l: 90 },
      yaxis: {
        title: axisTitle(options.yLabel || variable),
        automargin: true,
      },
      xaxis: {
        title: axisTitle('Photoperiod Averages'),
        automargin: true,
        categoryorder: 'array',
        categoryarray: ['Total', 'Dark', 'Light'],
      },
      boxmode: 'group',
      boxgap: 0.4,
      boxgroupgap: 0.5,
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      showlegend: true,
      annotations: boxRows.length ? [] : [{
        text: 'No data in selected time range',
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: 0.5,
        showarrow: false,
        font: { size: 14, color: '#6b7280' },
      }],
    },
    { responsive: true, displaylogo: false },
  )
}
