// Box-plot rendering.
// This file takes analysis-ready rows, computes photoperiod summaries for one
// variable, and builds the Plotly box plot configuration.
import { aggregateDetailRows, applyDefaultOutlierRemoval } from '../process'
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

function quantile(sortedValues, q) {
  if (!sortedValues.length) {
    return null
  }

  const position = (sortedValues.length - 1) * q
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex]
  }

  const weight = position - lowerIndex
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight
}

function buildBoxPlotDataset(rows, variable, options = {}) {
  if (!Array.isArray(rows) || !rows.length) {
    return []
  }

  const removeOutliers = options.removeOutliers ?? true
  const outlierHandledRows = removeOutliers ? applyDefaultOutlierRemoval(rows) : rows
  const hourlyVariables = variable === 'eb' ? ['feed', 'ee'] : [variable]
  const hourlyRows = aggregateDetailRows(outlierHandledRows, {
    per: 'hour',
    grp: false,
    variables: hourlyVariables,
  })
  const subjectPeriods = new Map()

  hourlyRows.forEach((row) => {
    const subjectId = row['subject.id']
    const baseKey = `${subjectId}::${row.groupName || 'Unknown'}`
    const periodBuckets = [
      { period: 'Total', include: true },
      { period: 'Dark', include: Number(row.light) === 0 },
      { period: 'Light', include: Number(row.light) === 1 },
    ]

    periodBuckets.forEach(({ period, include }) => {
      if (!include) {
        return
      }

      const key = `${baseKey}::${period}`
      const value = variable === 'eb'
        ? (row.feed === null || row.ee === null ? null : row.feed - row.ee)
        : row[variable]

      if (value === null || Number.isNaN(value)) {
        return
      }

      if (!subjectPeriods.has(key)) {
        subjectPeriods.set(key, {
          period,
          groupName: row.groupName || 'Unknown',
          color: row.color || '#888',
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

  if (!removeOutliers) {
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

  const buckets = new Map()
  subjectEntries.forEach((entry) => {
    const key = `${entry.groupName}::${entry.period}`
    if (!buckets.has(key)) {
      buckets.set(key, [])
    }
    buckets.get(key).push(entry.value)
  })

  const thresholds = new Map()
  buckets.forEach((values, key) => {
    if (values.length < 5) {
      thresholds.set(key, null)
      return
    }

    const sorted = [...values].sort((left, right) => left - right)
    const q1 = quantile(sorted, 0.25)
    const q3 = quantile(sorted, 0.75)

    if (q1 === null || q3 === null) {
      thresholds.set(key, null)
      return
    }

    const iqr = q3 - q1
    thresholds.set(key, {
      lower: q1 - (1.5 * iqr),
      upper: q3 + (1.5 * iqr),
    })
  })

  return subjectEntries
    .filter((entry) => {
      const threshold = thresholds.get(`${entry.groupName}::${entry.period}`)

      if (!threshold) {
        return true
      }

      return entry.value >= threshold.lower && entry.value <= threshold.upper
    })
    .sort((left, right) => {
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

  if (!target || !rows.length) {
    return
  }

  const boxRows = buildBoxPlotDataset(rows, variable, {
    removeOutliers: options.removeOutliers,
  })

  if (!boxRows.length) {
    return
  }

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
    },
    { responsive: true, displaylogo: false },
  )
}
