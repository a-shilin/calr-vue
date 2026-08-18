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

function sampleVariance(values) {
  if (values.length <= 1) {
    return 0
  }

  const avg = mean(values)
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
}

function logGamma(value) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ]

  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value)
  }

  const adjusted = value - 1
  let series = 0.99999999999980993
  coefficients.forEach((coefficient, index) => {
    series += coefficient / (adjusted + index + 1)
  })

  const t = adjusted + coefficients.length - 0.5
  return 0.5 * Math.log(2 * Math.PI) + (adjusted + 0.5) * Math.log(t) - t + Math.log(series)
}

function regularizedBeta(x, a, b) {
  if (x <= 0) {
    return 0
  }
  if (x >= 1) {
    return 1
  }

  const maxIterations = 100
  const epsilon = 3e-7
  const fpmin = 1e-30
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap

  if (Math.abs(d) < fpmin) {
    d = fpmin
  }
  d = 1 / d
  let h = d

  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) {
      d = fpmin
    }
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) {
      c = fpmin
    }
    d = 1 / d
    h *= d * c

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) {
      d = fpmin
    }
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) {
      c = fpmin
    }
    d = 1 / d
    const delta = d * c
    h *= delta

    if (Math.abs(delta - 1) < epsilon) {
      break
    }
  }

  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2)
    ? (front * h) / a
    : 1 - (front * regularizedBetaFraction(1 - x, b, a)) / b
}

function regularizedBetaFraction(x, a, b) {
  const maxIterations = 100
  const epsilon = 3e-7
  const fpmin = 1e-30
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap

  if (Math.abs(d) < fpmin) {
    d = fpmin
  }
  d = 1 / d
  let h = d

  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) {
      d = fpmin
    }
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) {
      c = fpmin
    }
    d = 1 / d
    h *= d * c

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) {
      d = fpmin
    }
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) {
      c = fpmin
    }
    d = 1 / d
    const delta = d * c
    h *= delta

    if (Math.abs(delta - 1) < epsilon) {
      break
    }
  }

  return h
}

function twoSidedWelchPValue(groupA, groupB) {
  if (groupA.length <= 1 || groupB.length <= 1) {
    return null
  }

  const meanA = mean(groupA)
  const meanB = mean(groupB)
  const varianceA = sampleVariance(groupA)
  const varianceB = sampleVariance(groupB)
  const standardErrorSquared = varianceA / groupA.length + varianceB / groupB.length

  if (!standardErrorSquared) {
    return null
  }

  const numerator = standardErrorSquared ** 2
  const denominator =
    (varianceA ** 2) / (groupA.length ** 2 * (groupA.length - 1)) +
    (varianceB ** 2) / (groupB.length ** 2 * (groupB.length - 1))
  const degreesOfFreedom = denominator ? numerator / denominator : groupA.length + groupB.length - 2

  if (!Number.isFinite(degreesOfFreedom) || degreesOfFreedom <= 0) {
    return null
  }

  const t = Math.abs((meanA - meanB) / Math.sqrt(standardErrorSquared))
  const x = degreesOfFreedom / (degreesOfFreedom + t ** 2)
  return Math.max(0, Math.min(1, regularizedBeta(x, degreesOfFreedom / 2, 0.5)))
}

function pValueToStars(pValue) {
  if (pValue === null || pValue >= 0.05) {
    return ''
  }
  if (pValue < 0.001) {
    return '***'
  }
  if (pValue < 0.01) {
    return '**'
  }
  return '*'
}

function resolveWeightMetrics(mode) {
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

  return metricsByMode[mode] || metricsByMode.total
}

function buildWeightSubjectEntries(rows) {
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

  return subjectEntries.map((entry) => ({
    ...entry,
    fatPercent: entry.totalMass && entry.fatMass !== null ? (entry.fatMass / entry.totalMass) * 100 : null,
    leanPercent: entry.totalMass && entry.leanMass !== null ? (entry.leanMass / entry.totalMass) * 100 : null,
  }))
}

export function buildWeightDataset(rows, {
  mode = 'total',
} = {}) {
  const entriesWithPercents = buildWeightSubjectEntries(rows)

  if (!entriesWithPercents.length) {
    return []
  }

  const metrics = resolveWeightMetrics(mode)
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

function buildWeightSignificanceRows(rows, { mode = 'total', groupOrder = [] } = {}) {
  const entries = buildWeightSubjectEntries(rows)
  const metrics = resolveWeightMetrics(mode)
  const groups = resolveGroupOrder(entries, groupOrder)

  if (groups.length < 2) {
    return []
  }

  return metrics.flatMap(({ key, label }) => {
    const valuesByGroup = new Map(groups.map((groupName) => [groupName, []]))

    entries.forEach((entry) => {
      const value = toNullableNumber(entry[key])
      if (value !== null && valuesByGroup.has(entry.groupName)) {
        valuesByGroup.get(entry.groupName).push(value)
      }
    })

    const rowsForMetric = []
    for (let i = 0; i < groups.length - 1; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const groupA = groups[i]
        const groupB = groups[j]
        const stars = pValueToStars(twoSidedWelchPValue(valuesByGroup.get(groupA) || [], valuesByGroup.get(groupB) || []))
        if (stars) {
          rowsForMetric.push({
            metric: label,
            groupA,
            groupB,
            annotation: stars,
          })
        }
      }
    }

    return rowsForMetric
  })
}

function buildSignificanceLayout({ significanceRows, weightRows, groups, metricOrder, getBarX }) {
  if (!significanceRows.length) {
    return { shapes: [], annotations: [], maxY: null }
  }

  const maxByMetric = new Map()
  metricOrder.forEach((metric) => {
    const metricRows = weightRows.filter((row) => row.metric === metric)
    const maxValue = Math.max(...metricRows.map((row) => row.mean + row.sem).filter(Number.isFinite))
    maxByMetric.set(metric, Number.isFinite(maxValue) ? maxValue : 0)
  })

  const dataMax = Math.max(...weightRows.map((row) => row.mean + row.sem).filter(Number.isFinite), 0)
  const step = Math.max(dataMax * 0.046, 0.9)
  const tick = step * 0.18
  const metricCounts = new Map()
  const shapes = []
  const annotations = []
  let maxY = dataMax

  significanceRows.forEach((row) => {
    const metricIndex = metricOrder.indexOf(row.metric)
    const groupAIndex = groups.indexOf(row.groupA)
    const groupBIndex = groups.indexOf(row.groupB)

    if (metricIndex < 0 || groupAIndex < 0 || groupBIndex < 0) {
      return
    }

    const level = metricCounts.get(row.metric) || 0
    metricCounts.set(row.metric, level + 1)

    const x0 = getBarX(metricIndex, groupAIndex)
    const x1 = getBarX(metricIndex, groupBIndex)
    const y = (maxByMetric.get(row.metric) || dataMax) + step * (level + 1)
    maxY = Math.max(maxY, y + step * 0.8)

    shapes.push(
      {
        type: 'line',
        xref: 'x',
        yref: 'y',
        x0,
        x1,
        y0: y,
        y1: y,
        line: { color: '#777777', width: 2 },
      },
      {
        type: 'line',
        xref: 'x',
        yref: 'y',
        x0,
        x1: x0,
        y0: y,
        y1: y - tick,
        line: { color: '#777777', width: 2 },
      },
      {
        type: 'line',
        xref: 'x',
        yref: 'y',
        x0: x1,
        x1,
        y0: y,
        y1: y - tick,
        line: { color: '#777777', width: 2 },
      },
    )

    annotations.push({
      x: (x0 + x1) / 2,
      y: y + step * 0.14,
      text: row.annotation,
      showarrow: false,
      font: {
        color: '#777777',
        size: 12,
      },
      xanchor: 'center',
      yanchor: 'middle',
    })
  })

  return { shapes, annotations, maxY }
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

  const groups = resolveGroupOrder(weightRows, options.groupOrder || analysisData?.session?.groupNames || [])
  const metricOrder = [...new Set(weightRows.map((row) => row.metric))]
  const barWidth = Math.min(0.18, 0.55 / Math.max(groups.length, 1))
  const barSpacing = barWidth * 1.15
  const getBarX = (metricIndex, groupIndex) => metricIndex + (groupIndex - (groups.length - 1) / 2) * barSpacing
  const significanceRows = buildWeightSignificanceRows(rows, {
    mode: options.mode || 'total',
    groupOrder: options.groupOrder || [],
  })
  const significanceLayout = buildSignificanceLayout({
    significanceRows,
    weightRows,
    groups,
    metricOrder,
    getBarX,
  })
  const traces = groups.map((groupName) => {
    const groupRows = weightRows.filter((row) => row.groupName === groupName)
    const byMetric = new Map(groupRows.map((row) => [row.metric, row]))
    const color = resolveGroupColor(groupName, options.groupColors, groupRows[0]?.color || '#888')

    return {
      x: metricOrder.map((metric, metricIndex) => getBarX(metricIndex, groups.indexOf(groupName))),
      y: metricOrder.map((metric) => byMetric.get(metric)?.mean ?? null),
      type: 'bar',
      name: groupName,
      width: barWidth,
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
      customdata: metricOrder.map((metric) => [metric, byMetric.get(metric)?.n ?? 0]),
      hovertemplate:
        `<b>${groupName}</b><br>` +
        '<b>Metric:</b> %{customdata[0]}<br>' +
        `<b>${options.yLabel || 'Mean'}:</b> %{y:.2f}<br>` +
        '<b>n:</b> %{customdata[1]}<extra></extra>',
    }
  })

  const xPadding = groups.length > 1 ? barSpacing * groups.length : 0.45
  const yAxis = {
    title: axisTitle(options.yLabel || 'Mean (g)'),
    automargin: true,
    rangemode: 'tozero',
  }

  if (significanceLayout.maxY !== null) {
    yAxis.range = [0, significanceLayout.maxY]
  }

  await renderPlot(
    target,
    traces,
    {
      margin: { l: 90, r: 20, t: 30, b: 70 },
      xaxis: {
        title: axisTitle(options.xLabel || ''),
        automargin: true,
        tickmode: 'array',
        tickvals: metricOrder.map((_, index) => index),
        ticktext: metricOrder,
        range: [-xPadding, Math.max(metricOrder.length - 1, 0) + xPadding],
      },
      yaxis: yAxis,
      shapes: significanceLayout.shapes,
      annotations: significanceLayout.annotations,
      showlegend: true,
      // Pinned so all plots agree on group order even if fills are added later.
      legend: { traceorder: 'normal' },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
    },
    { responsive: true, displaylogo: false },
  )
}
