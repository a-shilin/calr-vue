// Curve fits for the community comparison plot.
//
// The reference figures use two fits: ordinary least squares, and the loess
// smoother from ggplot's geom_smooth(method="loess"). There is no smoothing
// dependency in the app, so loess is implemented here directly.

export function computeOLS(xValues, yValues) {
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
  let residualSumSquares = 0

  for (let index = 0; index < count; index += 1) {
    residualSumSquares += (yValues[index] - (slope * xValues[index] + intercept)) ** 2
  }

  return {
    type: 'linear',
    slope,
    intercept,
    r2: totalSumSquares ? 1 - residualSumSquares / totalSumSquares : 1,
  }
}

// Weighted local linear regression at a single point. Returns null when the
// local neighbourhood is degenerate (all x identical), so the caller can fall
// back to the weighted mean.
function localLinearAt(x0, xValues, yValues, weights) {
  let sumWeight = 0
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumXY = 0

  for (let index = 0; index < xValues.length; index += 1) {
    const weight = weights[index]

    if (!weight) {
      continue
    }

    const x = xValues[index]
    const y = yValues[index]

    sumWeight += weight
    sumX += weight * x
    sumY += weight * y
    sumXX += weight * x * x
    sumXY += weight * x * y
  }

  if (!sumWeight) {
    return null
  }

  const meanX = sumX / sumWeight
  const meanY = sumY / sumWeight
  const varianceX = sumXX / sumWeight - meanX * meanX

  if (!Number.isFinite(varianceX) || Math.abs(varianceX) < 1e-12) {
    return meanY
  }

  const covariance = sumXY / sumWeight - meanX * meanY
  const slope = covariance / varianceX

  return meanY + slope * (x0 - meanX)
}

// Tricubic-weighted local linear smoother, matching geom_smooth(method="loess").
// `span` is the fraction of points in each local neighbourhood; the reference
// plots use span=1, which weights every point by its distance from the target.
export function computeLoess(xValues, yValues, { span = 1, resolution = 100 } = {}) {
  const count = xValues.length

  if (count < 4) {
    return null
  }

  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)

  if (!(maxX > minX)) {
    return null
  }

  const neighbourhood = Math.max(3, Math.min(count, Math.ceil(span * count)))
  const steps = Math.max(2, Math.min(resolution, count * 4))
  const fitted = []
  const distances = new Array(count)
  const weights = new Array(count)

  for (let step = 0; step < steps; step += 1) {
    const x0 = minX + ((maxX - minX) * step) / (steps - 1)

    for (let index = 0; index < count; index += 1) {
      distances[index] = Math.abs(xValues[index] - x0)
    }

    // Bandwidth is the distance to the furthest point in the neighbourhood.
    // Sorting a copy keeps the per-point distances aligned with the data.
    const sorted = [...distances].sort((left, right) => left - right)
    let bandwidth = sorted[neighbourhood - 1]

    if (span > 1) {
      bandwidth *= span
    }

    if (!(bandwidth > 0)) {
      bandwidth = Math.max(...sorted) || 1
    }

    for (let index = 0; index < count; index += 1) {
      const scaled = distances[index] / bandwidth
      weights[index] = scaled >= 1 ? 0 : (1 - scaled ** 3) ** 3
    }

    const predicted = localLinearAt(x0, xValues, yValues, weights)

    if (predicted !== null && Number.isFinite(predicted)) {
      fitted.push({ x: x0, y: predicted })
    }
  }

  if (fitted.length < 2) {
    return null
  }

  return {
    type: 'loess',
    points: fitted,
  }
}

export function computeFit(xValues, yValues, fitType) {
  if (fitType === 'linear') {
    return computeOLS(xValues, yValues)
  }

  if (fitType === 'loess') {
    return computeLoess(xValues, yValues)
  }

  return null
}

// Points to draw for a fit. Linear fits only need their endpoints.
export function fitCurvePoints(fit, xValues) {
  if (!fit) {
    return null
  }

  if (fit.type === 'loess') {
    return {
      x: fit.points.map((point) => point.x),
      y: fit.points.map((point) => point.y),
    }
  }

  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)

  return {
    x: [minX, maxX],
    y: [fit.slope * minX + fit.intercept, fit.slope * maxX + fit.intercept],
  }
}

function formatCoefficient(value) {
  const magnitude = Math.abs(value)

  if (magnitude !== 0 && (magnitude < 1e-3 || magnitude >= 1e5)) {
    return value.toExponential(2)
  }

  return value.toFixed(magnitude < 1 ? 4 : 3)
}

export function formatFitEquation(fit) {
  if (!fit || fit.type !== 'linear') {
    return null
  }

  const sign = fit.intercept < 0 ? '−' : '+'

  return `y = ${formatCoefficient(fit.slope)}x ${sign} ${formatCoefficient(Math.abs(fit.intercept))}, R² = ${fit.r2.toFixed(3)}`
}
