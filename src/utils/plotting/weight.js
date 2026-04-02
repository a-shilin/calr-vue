import { buildWeightDataset } from '../process'

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

function axisTitle(text) {
  return {
    text,
    standoff: 12,
    font: {
      size: 16,
    },
  }
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

export async function renderWeightPlot(target, rows, options = {}) {
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
    const color = groupRows[0]?.color || '#888'

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
