// Weight plot rendering.
// This file takes analysis-ready rows, derives total/composition summaries,
// and builds the Plotly weight plot variants.
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

function toNullableNumber(value) {
  if (value === null || value === undefined || `${value}`.trim() === '' || `${value}`.trim().toUpperCase() === 'NA') {
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

function sampleSem(values) {
  if (values.length <= 1) {
    return 0
  }

  const avg = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance) / Math.sqrt(values.length)
}

function buildWeightDataset(rows, {
  mode = 'total',
} = {}) {
  if (!Array.isArray(rows) || !rows.length) {
    return []
  }

  const subjects = new Map()
  rows.forEach((row) => {
    const subjectId = row['subject.id']
    if (!subjectId) {
      return
    }

    if (!subjects.has(subjectId)) {
      subjects.set(subjectId, {
        'subject.id': subjectId,
        groupName: row.groupName || 'Unknown',
        color: row.color || '#888',
        totalValues: [],
        leanValues: [],
        fatValues: [],
        subjectSession: row.subjectSession || {},
      })
    }

    const subject = subjects.get(subjectId)
    const totalValue = toNullableNumber(row['subject.mass'])
    const leanValue = toNullableNumber(row['subject.lean.mass'])
    const fatValue = toNullableNumber(row['subject.fat.mass'])

    if (totalValue !== null) {
      subject.totalValues.push(totalValue)
    }
    if (leanValue !== null) {
      subject.leanValues.push(leanValue)
    }
    if (fatValue !== null) {
      subject.fatValues.push(fatValue)
    }
  })

  const subjectEntries = [...subjects.values()].map((subject) => {
    const totalMass = toNullableNumber(subject.subjectSession.total_mass) ?? mean(subject.totalValues)
    const leanMass = toNullableNumber(subject.subjectSession.lean_mass) ?? mean(subject.leanValues)
    const fatMass = toNullableNumber(subject.subjectSession.fat_mass) ?? mean(subject.fatValues)

    return {
      'subject.id': subject['subject.id'],
      groupName: subject.groupName,
      color: subject.color,
      totalMass,
      leanMass,
      fatMass,
    }
  })

  const metricsByMode = {
    total: [{ key: 'totalMass', label: 'Total' }],
    composition: [
      { key: 'fatMass', label: 'Fat' },
      { key: 'leanMass', label: 'Lean' },
      { key: 'totalMass', label: 'Total' },
    ],
    compositionPercent: [
      { key: 'fatPercent', label: 'Fat' },
      { key: 'leanPercent', label: 'Lean' },
    ],
  }

  const entriesWithPercents = subjectEntries.map((entry) => ({
    ...entry,
    fatPercent: entry.totalMass && entry.fatMass !== null ? (entry.fatMass / entry.totalMass) * 100 : null,
    leanPercent: entry.totalMass && entry.leanMass !== null ? (entry.leanMass / entry.totalMass) * 100 : null,
  }))

  const metrics = metricsByMode[mode] || metricsByMode.total
  const grouped = new Map()

  entriesWithPercents.forEach((entry) => {
    if (!grouped.has(entry.groupName)) {
      grouped.set(entry.groupName, {
        color: entry.color,
        metrics: new Map(),
      })
    }

    const group = grouped.get(entry.groupName)
    metrics.forEach(({ key, label }) => {
      const value = toNullableNumber(entry[key])
      if (value === null) {
        return
      }

      if (!group.metrics.has(label)) {
        group.metrics.set(label, [])
      }

      group.metrics.get(label).push(value)
    })
  })

  return [...grouped.entries()].flatMap(([groupName, group]) =>
    metrics
      .map(({ label }) => {
        const values = group.metrics.get(label) || []
        if (!values.length) {
          return null
        }

        return {
          groupName,
          color: group.color,
          metric: label,
          mean: mean(values),
          sem: sampleSem(values),
          n: values.length,
        }
      })
      .filter(Boolean),
  )
}

export async function renderWeightPlot(target, analysisData, options = {}) {
  const rows = analysisData?.rows || []

  if (!target || !rows.length) {
    return
  }

  const weightRows = buildWeightDataset(rows, { mode: options.mode || 'total' })

  if (!weightRows.length) {
    return
  }

  const groups = resolveGroupOrder(weightRows, options.groupOrder || [])
  const metricOrder = [...new Set(weightRows.map((row) => row.metric))]
  const traces = groups.map((groupName) => {
    const groupRows = weightRows.filter((row) => row.groupName === groupName)
    const byMetric = new Map(groupRows.map((row) => [row.metric, row]))
    const color = resolveGroupColor(groupName, options.groupColors, groupRows[0]?.color || '#888')

    return {
      x: metricOrder,
      y: metricOrder.map((metric) => byMetric.get(metric)?.mean ?? null),
      type: 'bar',
      name: groupName,
      marker: {
        color,
        opacity: 0.7,
        line: {
          color: color,
          width: 1.5,
        },
      },
      error_y: {
        type: 'data',
        array: metricOrder.map((metric) => byMetric.get(metric)?.sem ?? 0),
        visible: true,
        color: color,
        thickness: 1.5,
        width: 5,
      },
      customdata: metricOrder.map((metric) => byMetric.get(metric)?.n ?? 0),
      hovertemplate:
        `<b>${groupName}</b><br>` +
        '<b>Metric:</b> %{x}<br>' +
        `<b>${options.yLabel || 'Mean'}:</b> %{y:.2f}<br>` +
        '<b>n:</b> %{customdata}<extra></extra>',
    }
  })

  await renderPlot(
    target,
    traces,
    {
      margin: { l: 90, r: 20, t: 30, b: 70 },
      xaxis: {
        title: axisTitle(options.xLabel || ''),
        automargin: true,
        categoryorder: 'array',
        categoryarray: metricOrder,
      },
      yaxis: {
        title: axisTitle(options.yLabel || 'Mean (g)'),
        automargin: true,
        rangemode: 'tozero',
      },
      barmode: 'group',
      bargap: 0.7,
      bargroupgap: 0.07,
      showlegend: true,
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
    },
    { responsive: true, displaylogo: false },
  )
}
