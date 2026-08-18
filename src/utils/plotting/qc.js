// QC plot rendering.
// This file takes QC analysis results from the backend and builds the Plotly
// scatter/regression view used in the analysis screen.
import { axisTitle, renderPlot } from './core'

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
  const allY = qcResults.subjects.map((subject) => subject.total_eb)
  const xMin = Math.min(...allX)
  const xMax = Math.max(...allX)
  const yMin = Math.min(...allY)
  const yMax = Math.max(...allY)

  const regressionTraces = groups
    .filter((group) => qcResults.group_regressions?.[group])
    .map((group) => {
      const regression = qcResults.group_regressions[group]
      const subset = qcResults.subjects.filter((subject) => subject.group === group)
      const groupX = subset.map((subject) => subject.mass_delta)
      const xValues = [Math.min(...groupX), Math.max(...groupX)]
      const yValues = xValues.map((value) => regression.slope * value + regression.intercept)

      return {
        x: xValues,
        y: yValues,
        mode: 'lines',
        type: 'scatter',
        name: `${group} : R2=${regression.r_squared}`,
        line: {
          color: colors[group],
          width: 2,
        },
        hovertemplate:
          `<b>${group} fit</b><br>` +
          `Slope: ${regression.slope}<br>` +
          `Intercept: ${regression.intercept}<br>` +
          `R²: ${regression.r_squared}<extra></extra>`,
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
  const overallAnnotation = overall
    ? [{
        xref: 'paper',
        yref: 'paper',
        x: 1.02,
        y: 0.2,
        xanchor: 'left',
        yanchor: 'top',
        align: 'left',
        showarrow: false,
        text: [
          `Slope:${overall.slope}`,
          `Intercept:${overall.intercept}`,
          `R.Squared:${overall.r_squared}`,
        ].join('<br>'),
        bordercolor: '#c7c7c7',
        borderwidth: 2,
        borderpad: 4,
        bgcolor: '#ff934d',
        opacity: 0.9,
        font: {
          family: 'Courier New, monospace',
          size: 12,
          color: '#ffffff',
        },
      }]
    : []

  await renderPlot(
    target,
    overallTrace ? [...scatterTraces, ...regressionTraces, overallTrace] : [...scatterTraces, ...regressionTraces],
    {
      title: options.title || undefined,
      margin: { l: 90, r: 180, t: 50, b: 70 },
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
          y0: yMin,
          y1: yMax,
          line: {
            color: 'black',
            width: 1,
          },
        },
      ],
      annotations: overallAnnotation,
      // Pinned so all plots agree on group order even if fills are added later.
      legend: { traceorder: 'normal' },
    },
    { responsive: true, displaylogo: false },
  )
}
