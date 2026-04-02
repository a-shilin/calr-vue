let plotlyPromise = null

async function getPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js-cartesian-dist-min').then((module) => module.default)
  }

  return plotlyPromise
}

async function renderPlot(target, traces, layout, config) {
  const Plotly = await getPlotly()
  await Plotly.react(target, traces, layout, config)
}

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

function computeSubjectAverage(rows, variable, subjectId) {
  return rows
    .filter((row) => row['subject.id'] === subjectId)
    .sort((left, right) => left['exp.minute'] - right['exp.minute'])
}

function computeLightDarkShading(rows) {
  const subject = rows[0]?.['subject.id']
  const subjectRows = rows
    .filter((row) => row['subject.id'] === subject)
    .sort((left, right) => left['exp.minute'] - right['exp.minute'])

  const segments = []
  let current = null

  subjectRows.forEach((row) => {
    const lightValue = Number(row['enviro.light'])
    const isDark = !Number.isNaN(lightValue) && lightValue <= 1

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

function computeSubjectPeriodAverages(rows, subjectId, variable, period) {
  const subjectRows = rows.filter((row) => row['subject.id'] === subjectId)

  let filteredRows = subjectRows
  if (period === 'Light') {
    filteredRows = subjectRows.filter((row) => Number(row['enviro.light']) > 1)
  } else if (period === 'Dark') {
    filteredRows = subjectRows.filter((row) => Number(row['enviro.light']) <= 1)
  }

  const values = filteredRows
    .map((row) => row[variable])
    .filter((value) => value !== null && !Number.isNaN(value))

  if (!values.length) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

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

function computeCI(x, y, slope, intercept) {
  const predictions = x.map((value) => slope * value + intercept)
  const residuals = predictions.map((prediction, index) => y[index] - prediction)
  const rss = residuals.reduce((sum, value) => sum + value * value, 0)

  return {
    se: Math.sqrt(rss / (x.length - 2)),
    t: 1.96,
  }
}

function hexToRGBA(hex, alpha) {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function axisTitle(text) {
  return {
    text,
    standoff: 12,
    font: {
      size: 16,
    },
  }
}

function resolveGroupOrder(values, preferredOrder = []) {
  const seen = new Set()
  const ordered = []

  preferredOrder.forEach((groupName) => {
    if (groupName && !seen.has(groupName)) {
      seen.add(groupName)
      ordered.push(groupName)
    }
  })

  values.forEach((groupName) => {
    if (groupName && !seen.has(groupName)) {
      seen.add(groupName)
      ordered.push(groupName)
    }
  })

  return ordered
}

function filterOutliersByMad(rows, variable) {
  const groupedValues = {}

  rows.forEach((row) => {
    const groupName = row.groupName || 'Unknown'
    const value = row[variable]

    if (value === null || Number.isNaN(value)) {
      return
    }

    if (!groupedValues[groupName]) {
      groupedValues[groupName] = []
    }

    groupedValues[groupName].push(value)
  })

  const thresholds = {}

  Object.entries(groupedValues).forEach(([groupName, values]) => {
    if (values.length < 5) {
      thresholds[groupName] = null
      return
    }

    const sortedValues = [...values].sort((left, right) => left - right)
    const median = sortedValues[Math.floor(sortedValues.length / 2)]
    const deviations = sortedValues.map((value) => Math.abs(value - median)).sort((left, right) => left - right)
    const mad = deviations[Math.floor(deviations.length / 2)]

    if (!mad) {
      thresholds[groupName] = null
      return
    }

    thresholds[groupName] = {
      lower: median - 3 * mad,
      upper: median + 3 * mad,
    }
  })

  return rows.filter((row) => {
    const threshold = thresholds[row.groupName || 'Unknown']
    const value = row[variable]

    if (!threshold || value === null || Number.isNaN(value)) {
      return true
    }

    return value >= threshold.lower && value <= threshold.upper
  })
}

export async function renderTimeSeriesPlot(target, rows, session, options, explorerVariables) {
  if (!target || !rows.length) {
    return
  }

  const yLabel = explorerVariables.find((item) => item.field === options.yVar)?.label || options.yVar
  const filteredRows = options.removeOutliers ? filterOutliersByMad(rows, options.yVar) : rows
  const timeRangeRows = filteredRows.filter((row) => row['exp.minute'] >= options.rangeStart * 60 && row['exp.minute'] <= options.rangeEnd * 60)
  const groups = {}

  timeRangeRows.forEach((row) => {
    const groupName = row.groupName || 'Unknown'
    if (!groups[groupName]) {
      groups[groupName] = []
    }
    groups[groupName].push(row)
  })

  const traces = []

  if (options.showIndividuals) {
    Object.entries(groups).forEach(([groupName, groupRows]) => {
      const color = groupRows[0]?.color || '#888'
      const subjects = {}

      groupRows.forEach((row) => {
        const subjectId = row['subject.id']
        if (!subjects[subjectId]) {
          subjects[subjectId] = []
        }
        subjects[subjectId].push(row)
      })

      Object.values(subjects).forEach((subjectRows) => {
        subjectRows.sort((left, right) => left['exp.minute'] - right['exp.minute'])

        traces.push({
          x: subjectRows.map((row) => row['exp.minute'] / 60),
          y: subjectRows.map((row) => row[options.yVar]),
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
    })
  }

  if (options.showMean) {
    Object.entries(groups).forEach(([groupName, groupRows]) => {
      const color = groupRows[0]?.color || '#888'
      const byMinute = {}

      groupRows.forEach((row) => {
        const minute = Math.round(row['exp.minute'])
        if (!byMinute[minute]) {
          byMinute[minute] = []
        }
        const value = row[options.yVar]
        if (value !== null && !Number.isNaN(value)) {
          byMinute[minute].push(value)
        }
      })

      const minutes = Object.keys(byMinute)
        .map((minute) => Number.parseInt(minute, 10))
        .sort((left, right) => left - right)

      const meanValues = []
      const semUpper = []
      const semLower = []

      minutes.forEach((minute) => {
        const values = byMinute[minute].filter((value) => value !== null && !Number.isNaN(value))

        if (!values.length) {
          meanValues.push(null)
          semUpper.push(null)
          semLower.push(null)
          return
        }

        const count = values.length
        const mean = values.reduce((sum, value) => sum + value, 0) / count

        if (count === 1) {
          meanValues.push(mean)
          semUpper.push(mean)
          semLower.push(mean)
          return
        }

        const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1)
        const sem = Math.sqrt(variance) / Math.sqrt(count)

        meanValues.push(mean)
        semUpper.push(mean + sem)
        semLower.push(mean - sem)
      })

      const windowSize = options.smoothing ? options.smoothWindow : 1
      const xHours = minutes.map((minute) => minute / 60)

      traces.push({
        x: xHours,
        y: smoothValues(semLower, windowSize),
        line: { width: 0 },
        hoverinfo: 'skip',
        fillcolor: hexToRGBA(color, 0.2),
        showlegend: false,
        name: `${groupName} (SEM lower)`,
        type: 'scatter',
      })

      traces.push({
        x: xHours,
        y: smoothValues(semUpper, windowSize),
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
        y: smoothValues(meanValues, windowSize),
        mode: 'lines',
        line: {
          color,
          width: 2,
        },
        name: groupName,
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

export async function renderDistributionPlot(target, rows, variable) {
  if (!target || !rows.length) {
    return
  }

  const yLabel = arguments[3]?.yLabel || variable

  const groups = {}
  const traces = []

  rows.forEach((row) => {
    const groupName = row.groupName || 'Unknown'
    if (!groups[groupName]) {
      groups[groupName] = []
    }
    groups[groupName].push(row)
  })

  Object.entries(groups).forEach(([groupName, groupRows]) => {
    const color = groupRows[0]?.color || '#888'
    const subjects = {}

    groupRows.forEach((row) => {
      const subjectId = row['subject.id']
      if (!subjects[subjectId]) {
        subjects[subjectId] = []
      }
      subjects[subjectId].push(row)
    })

    const totals = []
    const darks = []
    const lights = []

    Object.values(subjects).forEach((subjectRows) => {
      const allValues = subjectRows.map((row) => row[variable]).filter((value) => value !== null && !Number.isNaN(value))
      if (!allValues.length) {
        return
      }

      totals.push(allValues.reduce((sum, value) => sum + value, 0) / allValues.length)

      const darkRows = subjectRows.filter((row) => Number(row['enviro.light']) <= 1)
      const darkValues = darkRows.map((row) => row[variable]).filter((value) => value !== null && !Number.isNaN(value))
      if (darkValues.length) {
        darks.push(darkValues.reduce((sum, value) => sum + value, 0) / darkValues.length)
      }

      const lightRows = subjectRows.filter((row) => Number(row['enviro.light']) > 1)
      const lightValues = lightRows.map((row) => row[variable]).filter((value) => value !== null && !Number.isNaN(value))
      if (lightValues.length) {
        lights.push(lightValues.reduce((sum, value) => sum + value, 0) / lightValues.length)
      }
    })

    const xValues = [
      ...Array(totals.length).fill('Total'),
      ...Array(darks.length).fill('Dark'),
      ...Array(lights.length).fill('Light'),
    ]
    const yValues = [...totals, ...darks, ...lights]

    traces.push({
      y: yValues,
      x: xValues,
      type: 'box',
      name: groupName,
      marker: { color },
      line: { color },
      offsetgroup: groupName,
      boxpoints: false,
    })

    traces.push({
      y: yValues,
      x: xValues,
      mode: 'markers',
      type: 'box',
      marker: {
        color,
        size: 6,
        opacity: 0.7,
      },
      jitter: 0.2,
      pointpos: -1.3,
      offsetgroup: groupName,
      name: `${groupName} (pts)`,
      showlegend: false,
      boxpoints: 'all',
    })
  })

  await renderPlot(
    target,
    traces,
    {
      margin: { t: 20, r: 20, b: 70, l: 90 },
      yaxis: {
        title: axisTitle(yLabel),
        automargin: true,
      },
      xaxis: {
        title: axisTitle('Photoperiod Averages'),
        automargin: true,
        categoryorder: 'array',
        categoryarray: ['Total', 'Dark', 'Light'],
      },
      boxmode: 'group',
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
    },
    { responsive: true, displaylogo: false },
  )
}

export async function renderRegressionPlot(target, rows, options, explorerVariables) {
  if (!target || !rows.length) {
    return
  }

  const xLabel = options.xLabel || options.xVar
  const yLabel = options.yLabel || explorerVariables.find((item) => item.field === options.yVar)?.label || options.yVar

  const subjects = {}

  rows.forEach((row) => {
    const subjectId = row['subject.id']
    if (!subjects[subjectId]) {
      subjects[subjectId] = {
        yValues: [],
        group: row.groupName,
        color: row.color || '#888',
      }
    }

    if (row[options.yVar] !== null && !Number.isNaN(row[options.yVar])) {
      subjects[subjectId].yValues.push(row[options.yVar])
    }
  })

  const subjectData = Object.entries(subjects)
    .map(([subjectId, subject]) => ({
      sid: subjectId,
      x: computeSubjectPeriodAverages(rows, subjectId, options.xVar, options.period),
      y: subject.yValues.reduce((sum, value) => sum + value, 0) / subject.yValues.length,
      group: subject.group,
      color: subject.color,
    }))
    .filter((item) => item.x !== null && !Number.isNaN(item.x) && item.y !== null && !Number.isNaN(item.y))

  const groups = {}
  subjectData.forEach((item) => {
    if (!groups[item.group]) {
      groups[item.group] = []
    }
    groups[item.group].push(item)
  })

  const traces = []

  Object.entries(groups).forEach(([groupName, groupRows]) => {
    traces.push({
      x: groupRows.map((item) => item.x),
      y: groupRows.map((item) => item.y),
      mode: 'markers',
      type: 'scatter',
      name: groupName,
      marker: {
        color: groupRows[0].color,
        size: 9,
        opacity: 0.9,
      },
      customdata: groupRows,
      hovertemplate:
        '<b>Subject:</b> %{customdata.sid}<br>' +
        '<b>Mass:</b> %{x:.2f} g<br>' +
        `<b>${explorerVariables.find((item) => item.field === options.yVar)?.label || options.yVar}:</b> %{y:.4f}<br>` +
        '<b>Group:</b> %{customdata.group}<extra></extra>',
    })
  })

  Object.entries(groups).forEach(([groupName, groupRows]) => {
    if (groupRows.length < 2) {
      return
    }

    const xs = groupRows.map((item) => item.x)
    const ys = groupRows.map((item) => item.y)
    const { slope, intercept, r2 } = computeOLS(xs, ys)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const lineX = [minX, maxX]
    const lineY = [slope * minX + intercept, slope * maxX + intercept]
    const midX = (minX + maxX) / 2
    const midY = slope * midX + intercept

    if (options.showCI) {
      const { se, t } = computeCI(xs, ys, slope, intercept)
      const lower = lineY.map((value) => value - t * se)
      const upper = lineY.map((value) => value + t * se)

      traces.push({
        x: lineX,
        y: lower,
        mode: 'lines',
        line: { width: 0 },
        showlegend: false,
        hoverinfo: 'skip',
        type: 'scatter',
      })

      traces.push({
        x: lineX,
        y: upper,
        mode: 'lines',
        fill: 'tonexty',
        fillcolor: hexToRGBA(groupRows[0].color, 0.2),
        line: { width: 0 },
        name: `${groupName} CI`,
        hoverinfo: 'skip',
        type: 'scatter',
      })
    }

    traces.push({
      x: [minX, midX, maxX],
      y: [lineY[0], midY, lineY[1]],
      type: 'scatter',
      mode: 'lines+markers',
      marker: { size: 5, opacity: 0 },
      name: `${groupName} (OLS)`,
      line: { color: groupRows[0].color, width: 2 },
      hovertemplate:
        `<b>${groupName} OLS Regression</b><br>` +
        `Slope: ${slope.toFixed(4)}<br>` +
        `Intercept: ${intercept.toFixed(4)}<br>` +
        `R²: ${r2.toFixed(4)}<extra></extra>`,
    })
  })

  await renderPlot(
    target,
    traces,
    {
      margin: { l: 90, r: 20, t: 30, b: 80 },
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
    },
    { responsive: true, displaylogo: false },
  )
}

export async function renderQcPlot(target, qcResults, options = {}) {
  if (!target || !qcResults?.subjects?.length) {
    return
  }

  const groups = resolveGroupOrder(
    qcResults.subjects.map((subject) => subject.group),
    options.groupOrder || [],
  )
  const palette = ['#2ca02c', '#ff7f0e', '#1f77b4', '#d62728', '#9467bd', '#8c564b']
  const colors = {}

  groups.forEach((group, index) => {
    colors[group] = options.groupColors?.[group] || palette[index % palette.length]
  })

  const scatterTraces = groups.map((group) => {
    const subset = qcResults.subjects.filter((subject) => subject.group === group)

    return {
      x: subset.map((item) => item.mass_delta),
      y: subset.map((item) => item.total_eb),
      mode: 'markers',
      type: 'scatter',
      name: group,
      marker: {
        size: 10,
        color: colors[group],
      },
    }
  })

  const allX = qcResults.subjects.map((subject) => subject.mass_delta)
  const xMin = Math.min(...allX)
  const xMax = Math.max(...allX)

  const regressionTraces = groups
    .filter((group) => qcResults.group_regressions?.[group])
    .map((group) => {
      const regression = qcResults.group_regressions[group]
      const xValues = [xMin, xMax]
      const yValues = xValues.map((value) => regression.slope * value + regression.intercept)

      return {
        x: xValues,
        y: yValues,
        mode: 'lines',
        type: 'scatter',
        name: `${group} fit`,
        line: {
          color: colors[group],
          width: 2,
        },
        showlegend: false,
      }
    })

  const overall = qcResults.overall_regression
  const overallTrace = overall
    ? {
        x: [xMin, xMax],
        y: [xMin, xMax].map((value) => overall.slope * value + overall.intercept),
        mode: 'lines',
        type: 'scatter',
        name: 'Overall fit',
        line: {
          color: 'purple',
          width: 3,
          dash: 'dot',
        },
      }
    : null

  await renderPlot(
    target,
    overallTrace ? [...scatterTraces, ...regressionTraces, overallTrace] : [...scatterTraces, ...regressionTraces],
    {
      title: options.title || undefined,
      margin: { l: 90, r: 20, t: 50, b: 70 },
      xaxis: {
        title: axisTitle(options.xLabel || 'Change in Mass (g)'),
        automargin: true,
        zeroline: true,
      },
      yaxis: {
        title: axisTitle(options.yLabel || 'Total Energy Balance (kcal)'),
        automargin: true,
      },
      shapes: [
        {
          type: 'line',
          x0: 0,
          x1: 0,
          y0: Math.min(...qcResults.subjects.map((subject) => subject.total_eb)),
          y1: Math.max(...qcResults.subjects.map((subject) => subject.total_eb)),
          line: {
            color: 'black',
            width: 1,
          },
        },
      ],
    },
    { responsive: true, displaylogo: false },
  )
}

export async function renderPowerPlot(target, powerResults, options = {}) {
  if (!target || !powerResults?.power_curve?.length) {
    return
  }

  const curve = powerResults.power_curve
  const x = curve.map((item) => item.n_per_group)
  const y = curve.map((item) => item.power)
  const palette = ['#ff7f0e', '#d62728', '#8c564b', '#7f7f7f', '#17becf', '#bcbd22', '#e377c2', '#1f77b4']

  await renderPlot(
    target,
    [
      {
        x,
        y,
        mode: 'lines',
        type: 'scatter',
        name: 'Power curve',
        line: { color: 'black', width: 2 },
        hoverinfo: 'skip',
      },
      ...curve.map((item, index) => ({
        x: [item.n_per_group],
        y: [item.power],
        mode: 'markers',
        type: 'scatter',
        name: String(item.n_per_group),
        marker: {
          size: 10,
          color: palette[index % palette.length],
        },
      })),
    ],
    {
      title: options.title || undefined,
      margin: { l: 90, r: 20, t: 50, b: 70 },
      xaxis: {
        title: axisTitle(options.xLabel || 'Sample Size (per group)'),
        automargin: true,
      },
      yaxis: {
        title: axisTitle(options.yLabel || 'Power'),
        automargin: true,
        range: [0, 1],
      },
      showlegend: true,
      legend: {
        title: {
          text: 'n per group',
        },
      },
    },
    { responsive: true, displaylogo: false },
  )
}

export async function renderWeightPlot(target, rows, options = {}) {
  if (!target || !rows.length) {
    return
  }

  const subjects = {}

  rows.forEach((row) => {
    const subjectId = row['subject.id']

    if (!subjects[subjectId]) {
      subjects[subjectId] = {
        group: row.groupName || 'Unknown',
        color: row.color || '#888',
        values: [],
      }
    }

    const value = row['subject.mass']
    if (value !== null && !Number.isNaN(value)) {
      subjects[subjectId].values.push(value)
    }
  })

  const groups = {}

  Object.values(subjects).forEach((subject) => {
    if (!subject.values.length) {
      return
    }

    if (!groups[subject.group]) {
      groups[subject.group] = {
        color: subject.color,
        values: [],
      }
    }

    const subjectMean = subject.values.reduce((sum, value) => sum + value, 0) / subject.values.length
    groups[subject.group].values.push(subjectMean)
  })

  const traces = Object.entries(groups).map(([groupName, groupData]) => {
    const count = groupData.values.length
    const mean = groupData.values.reduce((sum, value) => sum + value, 0) / count
    const variance = count > 1
      ? groupData.values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1)
      : 0
    const sem = count > 1 ? Math.sqrt(variance) / Math.sqrt(count) : 0

    return {
      x: ['Total'],
      y: [mean],
      type: 'bar',
      name: groupName,
      marker: {
        color: groupData.color,
        line: {
          color: '#000000',
          width: 2,
        },
      },
      error_y: {
        type: 'data',
        array: [sem],
        visible: true,
        color: '#000000',
        thickness: 2,
        width: 6,
      },
      hovertemplate:
        `<b>${groupName}</b><br>` +
        'Mean: %{y:.2f} g<br>' +
        `SEM: ${sem.toFixed(2)} g<extra></extra>`,
    }
  })

  await renderPlot(
    target,
    traces,
    {
      margin: { l: 90, r: 20, t: 30, b: 70 },
      xaxis: {
        title: axisTitle(options.xLabel || 'Total'),
        automargin: true,
      },
      yaxis: {
        title: axisTitle(options.yLabel || 'Mean (g)'),
        automargin: true,
        rangemode: 'tozero',
      },
      barmode: 'group',
      showlegend: true,
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
    },
    { responsive: true, displaylogo: false },
  )
}

export async function renderSummaryRegressionPlot(target, rows, options) {
  if (!target || !rows.length) {
    return
  }

  const filteredRows = rows.filter((row) => options.selectedExperiments.includes(row.experiment_id))
  const xVar = options.xVar
  const yVar = options.yVar
  const groupVar = options.groupVar
  const highlighting = options.highlightedExperiments.length > 0
  const groups = {}

  filteredRows.forEach((row) => {
    const groupValue = row[groupVar] || 'Unknown'
    if (!groups[groupValue]) {
      groups[groupValue] = { highlighted: [], normal: [] }
    }

    const isHighlighted = options.highlightedExperiments.includes(row.experiment_id)
    if (isHighlighted) {
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

  const legendTraces = []
  const normalScatter = []
  const highlightedScatter = []
  const referenceLines = []
  const highlightedLines = []

  groupNames.forEach((groupName) => {
    const color = colorMap[groupName]
    const highlightedRows = groups[groupName].highlighted
    const normalRows = groups[groupName].normal

    legendTraces.push({
      x: [null],
      y: [null],
      mode: 'markers',
      type: 'scatter',
      name: groupName,
      marker: {
        color,
        size: 10,
      },
      showlegend: true,
      hoverinfo: 'skip',
    })

    normalRows.forEach((row) => {
      normalScatter.push({
        x: [row[xVar]],
        y: [row[yVar]],
        mode: 'markers',
        type: 'scatter',
        marker: {
          color: highlighting ? '#FFFFFF' : color,
          size: highlighting ? 5 : 9,
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
        marker: {
          color,
          size: 10,
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
      },
      yaxis: {
        title: axisTitle(yVar),
        automargin: true,
      },
      hovermode: 'closest',
      showlegend: true,
    },
    { responsive: true, displaylogo: false },
  )
}
