// Community summary regression rendering.
//
// One configurable scatter/fit plot serves every community regression figure.
// Color, faceting, fit type, and fit scope are independent options rather than
// per-figure presets, so any combination works on any dataset that follows the
// standard.
//
// Points are batched into one trace per series per panel rather than one trace
// per point: a single experiment can contribute a couple of thousand animals,
// and Plotly does not cope with that many traces.
import { labelFor, toFiniteNumber } from '../community-schema'
import { CONTINUOUS_COLORSCALE, continuousColor, withAlpha } from './community-color'
import { axisTitle, renderPlot } from './core'
import { computeFit, fitCurvePoints, formatFitEquation } from './fits'

// Beyond this many series a vertical legend is taller than the plot, so it
// moves below and wraps instead.
const WIDE_LEGEND_THRESHOLD = 12

const MAX_FACET_COLUMNS = 3

// Facet rows are sized in pixels rather than as a share of a fixed canvas, so
// that adding panels grows the figure instead of flattening every row.
const MIN_PANEL_HEIGHT = 200
const PANEL_ROW_GAP = 46
const UNKNOWN_SERIES = 'Unknown'
const GHOST_COLOR = 'rgba(125,131,140,0.22)'
const OVERALL_FIT_COLOR = '#111111'

export function collectPoints(rows, options) {
  const selected = new Set(options.selectedExperiments)
  const compared = new Set(options.highlightedExperiments)
  const { xVar, yVar, colorBy, facetBy, bins, isGradient, passesFilters } = options
  // Only restrict to known facet levels when actually faceting. An empty array
  // is truthy, so testing the array itself would build an empty allow-set and
  // silently reject every row.
  const facetAllowed =
    facetBy && options.facetLevels?.length ? new Set(options.facetLevels) : null
  const collected = []

  rows.forEach((row) => {
    const inCompared = compared.has(row.experiment_id)

    if (!inCompared && !selected.has(row.experiment_id)) {
      return
    }

    const x = toFiniteNumber(row[xVar])
    const y = toFiniteNumber(row[yVar])

    if (x === null || y === null) {
      return
    }

    const facet = facetBy ? `${row[facetBy] ?? ''}`.trim() || UNKNOWN_SERIES : null

    // A filtered-out point can only be shown as context inside a panel that
    // still exists, so rows whose own facet level was filtered away are gone.
    if (facetAllowed && !facetAllowed.has(facet)) {
      return
    }

    const kept = passesFilters ? passesFilters(row) : true
    let series = null
    let colorValue = null

    if (kept) {
      if (isGradient) {
        colorValue = toFiniteNumber(row[colorBy])

        if (colorValue === null) {
          return
        }
      } else if (bins) {
        series = bins.labelFor(row[colorBy])

        if (series === null) {
          return
        }
      } else {
        series = `${row[colorBy] ?? ''}`.trim() || UNKNOWN_SERIES
      }
    }

    collected.push({
      x,
      y,
      facet,
      series,
      colorValue,
      kept,
      isCompared: inCompared,
      experimentId: row.experiment_id,
      subjectId: row.subject_id,
      colorLabel: series ?? (colorValue === null ? '' : `${colorValue}`),
    })
  })

  return collected
}

function markerStyle(color, { highlighting, isCompared }) {
  if (highlighting && !isCompared) {
    // Group A recedes to an outline so the compared set reads on top of it.
    return {
      color: 'rgba(255,255,255,0.9)',
      size: 5,
      line: { width: 1, color },
    }
  }

  // Matches the reference figures' filled-circle-with-dark-outline points.
  return {
    color: withAlpha(color, 0.6),
    size: highlighting ? 8 : 7,
    line: { width: 1, color: 'rgba(0,0,0,0.55)' },
  }
}

// Panel geometry. Facets are laid out left to right, top to bottom.
export function buildPanelGrid(count) {
  // Four panels read better as a square than as a row of three plus an orphan.
  const columns = count === 4 ? 2 : Math.min(count, MAX_FACET_COLUMNS)
  const rowCount = Math.ceil(count / columns)
  const horizontalGap = columns > 1 ? 0.07 : 0
  const panelWidth = (1 - horizontalGap * (columns - 1)) / columns

  // Derive the vertical fractions from a pixel budget so each row keeps
  // MIN_PANEL_HEIGHT no matter how many rows there are.
  const plotAreaHeight = rowCount * MIN_PANEL_HEIGHT + (rowCount - 1) * PANEL_ROW_GAP
  const verticalGap = rowCount > 1 ? PANEL_ROW_GAP / plotAreaHeight : 0
  const panelHeight = rowCount > 1 ? MIN_PANEL_HEIGHT / plotAreaHeight : 1

  const panels = Array.from({ length: count }, (unused, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const left = column * (panelWidth + horizontalGap)
    const top = 1 - row * (panelHeight + verticalGap)

    return {
      index,
      column,
      row,
      isFirstColumn: column === 0,
      isLastRow: row === rowCount - 1 || index + columns >= count,
      xDomain: [left, left + panelWidth],
      yDomain: [top - panelHeight, top],
      xAxis: index === 0 ? 'x' : `x${index + 1}`,
      yAxis: index === 0 ? 'y' : `y${index + 1}`,
      xAxisKey: index === 0 ? 'xaxis' : `xaxis${index + 1}`,
      yAxisKey: index === 0 ? 'yaxis' : `yaxis${index + 1}`,
    }
  })

  return { panels, columns, rowCount, plotAreaHeight }
}

export async function renderSummaryRegressionPlot(target, rows, options) {
  if (!target || !rows.length) {
    return
  }

  const {
    xVar,
    yVar,
    colorBy,
    facetBy = '',
    facetLevels = [],
    bins = null,
    isGradient = false,
    seriesColors = new Map(),
    colorDomain = [],
    colorExtent = null,
    fitType = 'linear',
    fitScope = 'group',
    showEquations = false,
    showGhosts = true,
  } = options

  const xLabel = labelFor(xVar)
  const yLabel = labelFor(yVar)
  const colorLabel = labelFor(colorBy)
  const highlighting = options.highlightedExperiments.length > 0
  const points = collectPoints(rows, options)

  const panelLevels = facetBy && facetLevels.length ? facetLevels : [null]
  const { panels, rowCount, plotAreaHeight } = buildPanelGrid(panelLevels.length)
  const faceted = panelLevels.length > 1 || Boolean(facetBy)

  // A continuous color axis has no discrete series to fit separately.
  const effectiveFitScope = isGradient ? 'overall' : fitScope

  const hoverTemplate =
    `<b>${xLabel}:</b> %{x:.3f}<br>` +
    `<b>${yLabel}:</b> %{y:.3f}<br>` +
    `<b>${colorLabel}:</b> %{customdata[2]}<br>` +
    '<b>Experiment:</b> %{customdata[0]}<br>' +
    '<b>Animal:</b> %{customdata[1]}<extra></extra>'

  const ghostTraces = []
  const pointTraces = []
  const comparedTraces = []
  const fitTraces = []
  const annotations = []
  const layoutAxes = {}
  const legendShown = new Set()
  // Equation annotations stack downward, counted per panel.
  const equationCounts = new Map()
  let gradientScaleShown = false

  panels.forEach((panel, panelIndex) => {
    const level = panelLevels[panelIndex]
    const panelPoints = level === null ? points : points.filter((point) => point.facet === level)
    const kept = panelPoints.filter((point) => point.kept)
    const ghosts = panelPoints.filter((point) => !point.kept)

    layoutAxes[panel.xAxisKey] = {
      domain: panel.xDomain,
      anchor: panel.yAxis,
      automargin: !faceted,
      zeroline: false,
      showticklabels: !faceted || panel.isLastRow,
      ...(faceted ? {} : { title: axisTitle(xLabel) }),
      ...(panelIndex > 0 ? { matches: 'x' } : {}),
      ...(options.axisRanges ? { range: options.axisRanges.xRange } : {}),
    }

    layoutAxes[panel.yAxisKey] = {
      domain: panel.yDomain,
      anchor: panel.xAxis,
      automargin: !faceted,
      zeroline: false,
      showticklabels: !faceted || panel.isFirstColumn,
      ...(faceted ? {} : { title: axisTitle(yLabel) }),
      ...(panelIndex > 0 ? { matches: 'y' } : {}),
      ...(options.axisRanges ? { range: options.axisRanges.yRange } : {}),
    }

    if (faceted && level !== null) {
      // ggplot-style strip label above each panel.
      annotations.push({
        xref: 'paper',
        yref: 'paper',
        x: (panel.xDomain[0] + panel.xDomain[1]) / 2,
        y: panel.yDomain[1],
        // Shift in pixels, not paper units, so the label keeps the same small
        // gap above its panel however tall the figure grows.
        yshift: 6,
        xanchor: 'center',
        yanchor: 'bottom',
        text: `${level}`,
        showarrow: false,
        font: { size: 11, color: '#132033' },
        bgcolor: '#eceff3',
        bordercolor: '#d5d9dd',
        borderwidth: 1,
        borderpad: 3,
      })
    }

    const axisRefs = { xaxis: panel.xAxis, yaxis: panel.yAxis }

    if (showGhosts && ghosts.length) {
      ghostTraces.push({
        x: ghosts.map((point) => point.x),
        y: ghosts.map((point) => point.y),
        mode: 'markers',
        type: 'scatter',
        name: 'Filtered out',
        marker: { color: GHOST_COLOR, size: 6, line: { width: 0 } },
        // Background context only: letting these win closest-point hover would
        // make the visible points hard to inspect.
        hoverinfo: 'skip',
        showlegend: false,
        ...axisRefs,
      })
    }

    const pointTrace = (name, seriesPoints, { legendgroup, legendTitle, marker, showlegend, gradient }) => ({
      x: seriesPoints.map((point) => point.x),
      y: seriesPoints.map((point) => point.y),
      customdata: seriesPoints.map((point) => [point.experimentId, point.subjectId, point.colorLabel]),
      mode: 'markers',
      type: 'scatter',
      name,
      legendgroup,
      legendgrouptitle: legendTitle ? { text: legendTitle } : undefined,
      marker: gradient
        ? {
            color: seriesPoints.map((point) => point.colorValue),
            colorscale: CONTINUOUS_COLORSCALE,
            cmin: colorExtent?.min,
            cmax: colorExtent?.max,
            size: 8,
            opacity: 0.85,
            line: { width: 1, color: 'rgba(0,0,0,0.45)' },
            showscale: gradient === 'primary',
            colorbar:
              gradient === 'primary'
                ? { title: { text: colorLabel, side: 'right' }, thickness: 14 }
                : undefined,
          }
        : marker,
      hovertemplate: hoverTemplate,
      showlegend,
      ...axisRefs,
    })

    const addFit = (fitPoints, color, legendgroup, seriesName, width) => {
      if (fitType === 'none' || fitPoints.length < 2) {
        return
      }

      const xValues = fitPoints.map((point) => point.x)
      const yValues = fitPoints.map((point) => point.y)
      const fit = computeFit(xValues, yValues, fitType)
      const curve = fitCurvePoints(fit, xValues)

      if (!curve) {
        return
      }

      fitTraces.push({
        x: curve.x,
        y: curve.y,
        mode: 'lines',
        type: 'scatter',
        legendgroup,
        line: { color, width },
        hoverinfo: 'skip',
        showlegend: false,
        ...axisRefs,
      })

      const equation = formatFitEquation(fit)

      if (showEquations && equation) {
        const stackIndex = equationCounts.get(panel.index) || 0
        equationCounts.set(panel.index, stackIndex + 1)

        annotations.push({
          xref: `${panel.xAxis} domain`,
          yref: `${panel.yAxis} domain`,
          x: 0.02,
          y: 0.98 - stackIndex * 0.06,
          xanchor: 'left',
          yanchor: 'top',
          text: seriesName ? `${seriesName}: ${equation}` : equation,
          showarrow: false,
          align: 'left',
          font: { size: 10, color },
        })
      }
    }

    const keptNormal = kept.filter((point) => !point.isCompared)
    const keptCompared = kept.filter((point) => point.isCompared)

    if (isGradient) {
      if (keptNormal.length) {
        pointTraces.push(
          pointTrace(colorLabel, keptNormal, {
            legendgroup: 'gradient',
            showlegend: false,
            gradient: gradientScaleShown ? 'secondary' : 'primary',
          }),
        )
        gradientScaleShown = true
      }

      if (keptCompared.length) {
        comparedTraces.push(
          pointTrace(`${colorLabel} (Group B)`, keptCompared, {
            legendgroup: 'gradient_compare',
            showlegend: false,
            gradient: gradientScaleShown ? 'secondary' : 'primary',
          }),
        )
        gradientScaleShown = true
      }
    } else {
      const bySeries = (source) => {
        const grouped = new Map()

        source.forEach((point) => {
          if (!grouped.has(point.series)) {
            grouped.set(point.series, [])
          }

          grouped.get(point.series).push(point)
        })

        return grouped
      }

      const normalBySeries = bySeries(keptNormal)
      const comparedBySeries = bySeries(keptCompared)
      const order = colorDomain.length
        ? colorDomain
        : [...new Set([...normalBySeries.keys(), ...comparedBySeries.keys()])].sort((left, right) =>
            left.localeCompare(right),
          )

      order.forEach((series) => {
        const color = seriesColors.get(series) || continuousColor(0.5)
        const normalPoints = normalBySeries.get(series)
        const comparedPoints = comparedBySeries.get(series)

        if (normalPoints?.length) {
          const legendKey = `all_${series}`
          pointTraces.push(
            pointTrace(series, normalPoints, {
              legendgroup: legendKey,
              legendTitle: highlighting && !legendShown.size ? 'Group A' : null,
              marker: markerStyle(color, { highlighting, isCompared: false }),
              // Faceting repeats every series in each panel; only the first
              // occurrence carries a legend entry, and legendgroup keeps the
              // toggle applying across panels.
              showlegend: !legendShown.has(legendKey),
            }),
          )
          legendShown.add(legendKey)

          if (effectiveFitScope === 'group') {
            addFit(normalPoints, color, legendKey, series, 2)
          }
        }

        if (comparedPoints?.length) {
          const legendKey = `compare_${series}`
          comparedTraces.push(
            pointTrace(series, comparedPoints, {
              legendgroup: legendKey,
              legendTitle: [...legendShown].some((key) => key.startsWith('compare_'))
                ? null
                : 'Group B',
              marker: markerStyle(color, { highlighting, isCompared: true }),
              showlegend: !legendShown.has(legendKey),
            }),
          )
          legendShown.add(legendKey)

          if (effectiveFitScope === 'group') {
            addFit(comparedPoints, color, legendKey, `${series} (B)`, 4)
          }
        }
      })
    }

    if (effectiveFitScope === 'overall') {
      // A single fit across the panel, drawn dark so it reads against whatever
      // the points are colored by.
      addFit(keptNormal, OVERALL_FIT_COLOR, 'overall', highlighting ? 'Group A' : null, 2.5)

      if (keptCompared.length) {
        addFit(keptCompared, OVERALL_FIT_COLOR, 'overall_compare', 'Group B', 4)
      }
    }
  })

  const seriesCount = legendShown.size
  const wideLegend = !isGradient && seriesCount > WIDE_LEGEND_THRESHOLD
  // Name the variable the colors encode. Without it the legend lists values
  // with no indication of what they are. Group A / B, when present, stay as
  // subgroup titles underneath this.
  const legendTitle = { text: colorLabel, font: { size: 12 } }

  if (faceted) {
    // Shared axes mean one title each, placed against the whole grid.
    annotations.push(
      {
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: 0,
        yshift: -38,
        xanchor: 'center',
        yanchor: 'top',
        text: xLabel,
        showarrow: false,
        font: { size: 16 },
      },
      {
        xref: 'paper',
        yref: 'paper',
        x: 0,
        xshift: -62,
        y: 0.5,
        xanchor: 'center',
        yanchor: 'middle',
        text: yLabel,
        showarrow: false,
        textangle: -90,
        font: { size: 16 },
      },
    )
  }

  const marginTop = faceted ? 46 : 30
  const marginBottom = wideLegend ? 130 : 70
  // A single row keeps filling its container; multiple rows drive the height so
  // panels stay readable and the page scrolls instead.
  const explicitHeight = rowCount > 1 ? marginTop + plotAreaHeight + marginBottom : null

  // Keep the container in step with the figure, otherwise the responsive
  // handler measures the old container height and squashes it back.
  target.style.height = explicitHeight ? `${explicitHeight}px` : ''

  await renderPlot(
    target,
    [...ghostTraces, ...pointTraces, ...comparedTraces, ...fitTraces],
    {
      ...(explicitHeight ? { height: explicitHeight } : {}),
      margin: {
        l: 90,
        r: isGradient ? 90 : 20,
        t: marginTop,
        b: marginBottom,
      },
      ...layoutAxes,
      hovermode: 'closest',
      showlegend: !isGradient,
      legend: wideLegend
        ? {
            title: legendTitle,
            orientation: 'h',
            y: -0.22,
            yanchor: 'top',
            x: 0,
            font: { size: 9 },
            tracegroupgap: 0,
          }
        : { title: legendTitle, tracegroupgap: 0 },
      annotations,
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
    },
    { responsive: true, displaylogo: false },
  )
}
