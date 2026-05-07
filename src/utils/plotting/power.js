// Power plot rendering.
// This file takes backend power-analysis results and builds the Plotly power
// curve used in the analysis screen.
import { axisTitle, renderPlot } from './core'

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
        range: [0, 1.03],
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
