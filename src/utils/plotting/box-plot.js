import { buildBoxPlotDataset } from '../process'

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

export async function renderBoxPlot(target, rows, variable, options = {}) {
  if (!target || !rows.length) {
    return
  }

  const boxRows = buildBoxPlotDataset(rows, variable)

  if (!boxRows.length) {
    return
  }

  const groups = [...new Set(rows.map((row) => row.groupName).filter(Boolean))]
  const traces = []

  groups.forEach((groupName) => {
    const groupRows = boxRows.filter((row) => row.groupName === groupName)
    const color = groupRows[0]?.color || '#888'

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
