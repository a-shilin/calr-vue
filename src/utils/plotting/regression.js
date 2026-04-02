import { buildRegressionDataset } from '../process'

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

function computeOLS(xValues, yValues) {
  const count = xValues.length

  if (count < 2) {
    return null
  }

  const meanX = xValues.reduce((sum, value) => sum + value, 0) / count
  const meanY = yValues.reduce((sum, value) => sum + value, 0) / count

  let numerator = 0
  let denominator = 0
  let totalSumSquares = 0

  for (let index = 0; index < count; index += 1) {
    numerator += (xValues[index] - meanX) * (yValues[index] - meanY)
    denominator += (xValues[index] - meanX) ** 2
    totalSumSquares += (yValues[index] - meanY) ** 2
  }

  if (!denominator) {
    return null
  }

  const slope = numerator / denominator
  const intercept = meanY - slope * meanX
  const predicted = xValues.map((value) => slope * value + intercept)
  const residualSumSquares = yValues.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0)

  return {
    slope,
    intercept,
    r2: totalSumSquares ? 1 - residualSumSquares / totalSumSquares : 1,
  }
}

function computeConstantBand(xValues, yValues, slope, intercept) {
  if (xValues.length <= 2) {
    return null
  }

  const residualSumSquares = yValues.reduce((sum, value, index) => {
    const predicted = xValues[index] * slope + intercept
    return sum + (value - predicted) ** 2
  }, 0)

  return {
    se: Math.sqrt(residualSumSquares / (xValues.length - 2)),
    t: 1.96,
  }
}

export async function renderRegressionPlot(target, rows, options = {}) {
  if (!target || !rows.length) {
    return
  }

  const regressionRows = buildRegressionDataset(rows, options)

  if (!regressionRows.length) {
    return
  }

  const xLabel = options.xLabel || options.xVar
  const yLabel = options.yLabel || options.yVar
  const groups = [...new Set(regressionRows.map((row) => row.groupName).filter(Boolean))]
  const traces = []

  groups.forEach((groupName) => {
    const groupRows = regressionRows.filter((row) => row.groupName === groupName)

    if (!groupRows.length) {
      return
    }

    traces.push({
      x: groupRows.map((row) => row.x),
      y: groupRows.map((row) => row.y),
      mode: 'markers',
      type: 'scatter',
      name: groupName,
      marker: {
        color: groupRows[0].color,
        size: 10,
        opacity: 0.9,
      },
      customdata: groupRows.map((row) => ({
        subjectId: row['subject.id'],
        groupName: row.groupName,
      })),
      hovertemplate:
        '<b>Subject:</b> %{customdata.subjectId}<br>' +
        `<b>${xLabel}:</b> %{x:.4f}<br>` +
        `<b>${yLabel}:</b> %{y:.4f}<br>` +
        '<b>Group:</b> %{customdata.groupName}<extra></extra>',
    })

    const xValues = groupRows.map((row) => row.x)
    const yValues = groupRows.map((row) => row.y)
    const fit = computeOLS(xValues, yValues)

    if (!fit) {
      return
    }

    const minX = Math.min(...xValues)
    const maxX = Math.max(...xValues)
    const lineX = [minX, maxX]
    const lineY = lineX.map((value) => fit.slope * value + fit.intercept)

    if (options.showCI) {
      const band = computeConstantBand(xValues, yValues, fit.slope, fit.intercept)

      if (band) {
        traces.push({
          x: lineX,
          y: lineY.map((value) => value - band.t * band.se),
          mode: 'lines',
          line: { width: 0 },
          hoverinfo: 'skip',
          showlegend: false,
          type: 'scatter',
        })

        traces.push({
          x: lineX,
          y: lineY.map((value) => value + band.t * band.se),
          mode: 'lines',
          fill: 'tonexty',
          fillcolor: hexToRGBA(groupRows[0].color, 0.2),
          line: { width: 0 },
          hoverinfo: 'skip',
          showlegend: false,
          type: 'scatter',
        })
      }
    }

    traces.push({
      x: lineX,
      y: lineY,
      mode: 'lines',
      type: 'scatter',
      name: `R²=${fit.r2.toFixed(4)}`,
      line: {
        color: groupRows[0].color,
        width: 2,
      },
      hovertemplate:
        `<b>${groupName} OLS Regression</b><br>` +
        `Slope: ${fit.slope.toFixed(4)}<br>` +
        `Intercept: ${fit.intercept.toFixed(4)}<br>` +
        `R²: ${fit.r2.toFixed(4)}<extra></extra>`,
    })
  })

  await renderPlot(
    target,
    traces,
    {
      margin: { l: 90, r: 200, t: 30, b: 80 },
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
      annotations: Array.isArray(options.statsLegendLines) && options.statsLegendLines.length
        ? [{
            xref: 'paper',
            yref: 'paper',
            x: 1.02,
            y: 0.2,
            xanchor: 'left',
            yanchor: 'top',
            align: 'left',
            showarrow: false,
            text: options.statsLegendLines.join('<br>'),
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
        : [],
      hovermode: 'closest',
      showlegend: true,
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
    },
    { responsive: true, displaylogo: false },
  )
}
