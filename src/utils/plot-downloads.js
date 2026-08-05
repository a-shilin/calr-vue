import { aggregateDetailRows, applyDefaultOutlierRemoval } from './process'
import { buildRegressionDataset } from './plotting/regression'
import { buildWeightDataset } from './plotting/weight'

export const PLOT_DOWNLOAD_OPTIONS = {
  time: [
    { key: 'plotData', label: 'Plot Data' },
    { key: 'individualHourData', label: 'Individual Hour Data' },
    { key: 'outliersReport', label: 'Outliers Report' },
  ],
  distribution: [
    { key: 'plotData', label: 'Plot Data' },
    { key: 'overallAverageData', label: 'Overall Average Data' },
  ],
  regression: [
    { key: 'plotData', label: 'Plot Data' },
  ],
  weight: [
    { key: 'plotData', label: 'Plot Data' },
  ],
  qc: [
    { key: 'plotData', label: 'Plot Data' },
  ],
  power: [
    { key: 'plotData', label: 'Plot Data' },
  ],
  ancova: [
    { key: 'plotData', label: 'Plot Data' },
    { key: 'postHocData', label: 'Post Hoc Data' },
  ],
}

export function plotDownloadOptions(key) {
  return PLOT_DOWNLOAD_OPTIONS[key] || [{ key: 'plotData', label: 'Plot Data' }]
}

export function canDownloadPlotData(ctx, key, optionKey = 'plotData') {
  if (key === 'qc') {
    return ctx.analysisRows.length > 0
  }

  if (key === 'power') {
    return Boolean(ctx.xp.powerResults?.power_curve?.length)
  }

  if (key === 'ancova') {
    if (optionKey === 'postHocData') {
      return Boolean(ctx.xp.ancovaResults?.ancova_pairwise?.length || ctx.xp.ancovaResults?.anova_pairwise?.length)
    }

    return Boolean(ctx.xp.ancovaResults)
  }

  if (key === 'weight') {
    return ctx.analysisRows.length > 0 && (!optionKey || optionKey === 'plotData')
  }

  if (key === 'time' && optionKey === 'outliersReport') {
    return Boolean(ctx.analysisOptions.removeOutliers && ctx.analysisRows.length)
  }

  return ctx.analysisRows.length > 0
}

export function buildPlotDownloadFilename(key, optionKey = 'plotData', sourceName = 'analysis') {
  const identifier = sanitizeDownloadIdentifier(sourceName)
  const suffixByOption = {
    plotData: `${key}_plot_data`,
    individualHourData: `${key}_individual_hour_data`,
    overallAverageData: `${key}_overall_average_data`,
    outliersReport: `${key}_outliers_report`,
    postHocData: `${key}_post_hoc_data`,
  }
  const suffix = sanitizeDownloadIdentifier(suffixByOption[optionKey] || `${key}_${optionKey}`)
  return `${identifier}_${suffix}.csv`
}

export function normalizeCsvRows(rows) {
  return rows.map((row) => Object.entries(row || {}).reduce((accumulator, [key, value]) => {
    if (value === undefined) {
      return accumulator
    }

    accumulator[key] = value && typeof value === 'object' ? JSON.stringify(value) : value
    return accumulator
  }, {}))
}

export function buildPlotDownloadRows(ctx, key, optionKey = 'plotData') {
  if (key === 'time') {
    if (optionKey === 'individualHourData') {
      return buildTimeIndividualHourDownloadRows(ctx)
    }

    if (optionKey === 'outliersReport') {
      return buildOutliersReportRows(ctx)
    }

    return buildTimePlotDownloadRows(ctx)
  }

  if (key === 'distribution') {
    return optionKey === 'overallAverageData'
      ? buildDistributionOverallAverageDownloadRows(ctx)
      : buildDistributionPlotDownloadRows(ctx)
  }

  if (key === 'regression') {
    return buildRegressionPlotDownloadRows(ctx)
  }

  if (key === 'weight') {
    return buildWeightPlotDownloadRows(ctx)
  }

  if (key === 'qc') {
    return buildQcPlotDownloadRows(ctx)
  }

  if (key === 'power') {
    return buildPowerPlotDownloadRows(ctx)
  }

  if (key === 'ancova') {
    return optionKey === 'postHocData'
      ? buildAncovaPostHocDownloadRows(ctx)
      : buildAncovaDownloadRows(ctx)
  }

  return []
}

function buildTimePlotDownloadRows(ctx) {
  const rows = ctx.analysisOptions.removeOutliers ? applyDefaultOutlierRemoval(ctx.analysisRows) : ctx.analysisRows
  const rangedRows = filterRowsByHourRange(rows, ctx.timeOptions.rangeStart, Math.min(ctx.timeOptions.rangeEnd, ctx.maxHour))
  const sourceBuckets = buildTimeSourceBuckets(rangedRows)
  const groupedRows = aggregateDetailRows(rangedRows, {
    per: 'min',
    grp: true,
    variables: timeDownloadVariables(ctx),
  })

  const exportRows = renameAggregateColumns(groupedRows).map((row) => {
    const sourceRows = sourceBuckets.get(timeSourceBucketKey(row)) || []
    return orderTimePlotDataRow({
      ...row,
      ...buildTimeSourceExportColumns(sourceRows),
      group: row.group || row.groupName,
      minute: row.minute ?? row['exp.minute'],
      alexstime: row['exp.minute'] != null ? row['exp.minute'] / 60 : row.hour,
      groupName: undefined,
      groupIndex: undefined,
      color: undefined,
      diet: undefined,
      dietCal: undefined,
      n: undefined,
    })
  })

  return addTimeRollmeanColumns(exportRows, ctx.timeOptions.yVar)
}

function buildTimeSourceBuckets(rows) {
  return rows.reduce((buckets, row) => {
    const key = timeSourceBucketKey(row)
    if (!key) {
      return buckets
    }

    if (!buckets.has(key)) {
      buckets.set(key, [])
    }

    buckets.get(key).push(row)
    return buckets
  }, new Map())
}

function timeSourceBucketKey(row) {
  const group = row.group || row.groupName || 'Unknown'
  const minute = toFiniteNumber(row['exp.minute'] ?? row.minute)
  if (minute === null) {
    return ''
  }

  return `${group}::${Math.round(minute)}`
}

function buildTimeSourceExportColumns(sourceRows) {
  if (!sourceRows.length) {
    return {}
  }

  const xValues = sourceRows
    .map((row) => toFiniteNumber(row.X ?? row['']))
    .filter((value) => value !== null)
  const firstValue = (...fields) => {
    const match = sourceRows.find((row) =>
      fields.some((field) => row[field] !== null && row[field] !== undefined && row[field] !== ''),
    )
    if (!match) {
      return ''
    }

    const field = fields.find((candidate) => match[candidate] !== null && match[candidate] !== undefined && match[candidate] !== '')
    return field ? match[field] : ''
  }
  const timestamp = firstValue('Date.Time', 'Time.Date')

  return {
    day: firstValue('day'),
    hour: firstValue('hour'),
    minute: firstValue('Date.Time', 'Time.Date', 'minute'),
    'Date.Time.mean': timestamp,
    'Date.Time.sem': timestamp ? 0 : '',
    'X.mean': xValues.length ? meanValues(xValues) : '',
    'X.sem': xValues.length ? sampleSem(xValues) : '',
  }
}

function addTimeRollmeanColumns(rows, yVar) {
  const meanKey = `${yVar}.mean`
  const semKey = `${yVar}.sem`
  const meanValuesForRows = rows.map((row) => toFiniteNumber(row[meanKey]))
  const semValues = rows.map((row) => toFiniteNumber(row[semKey]))
  const rollingMeans = rollingMean(meanValuesForRows, 5)
  const rollingSems = rollingMean(semValues, 5)

  return rows.map((row, index) => ({
    ...row,
    'exp.rollmean.mean': rollingMeans[index] ?? '',
    'exp.rollmean.sem': rollingSems[index] ?? '',
  }))
}

function rollingMean(values, windowSize) {
  const halfWindow = Math.floor(windowSize / 2)
  return values.map((_, index) => {
    const windowValues = []

    for (let cursor = index - halfWindow; cursor <= index + halfWindow; cursor += 1) {
      if (cursor >= 0 && cursor < values.length && values[cursor] !== null) {
        windowValues.push(values[cursor])
      }
    }

    return windowValues.length ? meanValues(windowValues) : null
  })
}

function buildTimeIndividualHourDownloadRows(ctx) {
  const rows = ctx.analysisOptions.removeOutliers ? applyDefaultOutlierRemoval(ctx.analysisRows) : ctx.analysisRows
  const rangedRows = filterRowsByHourRange(rows, ctx.timeOptions.rangeStart, Math.min(ctx.timeOptions.rangeEnd, ctx.maxHour))
  const hourlyRows = aggregateDetailRows(rangedRows, {
    per: 'hour',
    grp: false,
    variables: timeDownloadVariables(ctx),
  })

  return renameAggregateColumns(hourlyRows).map((row) => ({
    ...row,
    group: row.group || row.groupName,
    minute: row.minute ?? row['exp.minute'],
    groupName: undefined,
    groupIndex: undefined,
    color: undefined,
    diet: undefined,
    dietCal: undefined,
  }))
}

function buildOutliersReportRows(ctx) {
  const methods = [
    ['individual phase_subject', buildOutlierSummaryCounts(ctx.analysisRows, 'individual phase', 'subject')],
    ['individual phase_group', buildOutlierSummaryCounts(ctx.analysisRows, 'individual phase', 'group')],
    ['all light/all dark_subject', buildOutlierSummaryCounts(ctx.analysisRows, 'all light/all dark', 'subject')],
    ['all light/all dark_group', buildOutlierSummaryCounts(ctx.analysisRows, 'all light/all dark', 'group')],
    ['forecast_subject', emptyOutlierSummaryCounts()],
    ['forecast_group', emptyOutlierSummaryCounts()],
    ['default', buildOutlierSummaryCounts(ctx.analysisRows, 'default', 'group')],
    ['Total data points', buildOutlierTotalCounts(ctx.analysisRows)],
  ]

  return methods.map(([dataFrame, counts], index) => ({
    '': index + 1,
    data_frame: dataFrame,
    ...counts,
  }))
}

const OUTLIER_REPORT_COLUMNS = ['vo2', 'vco2', 'ee', 'rer', 'feed', 'drink', 'xytot', 'xyamb', 'wheel', 'pedmeter', 'allmeter', 'body.temp']
const OUTLIER_REMOVAL_COLUMNS = ['vo2', 'vco2', 'ee', 'rer', 'body.temp']
const PRIMARY_METABOLIC_COLUMNS = ['vo2', 'vco2', 'ee', 'rer']

function emptyOutlierSummaryCounts() {
  return OUTLIER_REPORT_COLUMNS.reduce((counts, column) => {
    counts[column] = 0
    return counts
  }, {})
}

function buildOutlierTotalCounts(rows) {
  return OUTLIER_REPORT_COLUMNS.reduce((counts, column) => {
    counts[column] = rows.reduce((total, row) => total + (toFiniteNumber(row[column]) === null ? 0 : 1), 0)
    return counts
  }, {})
}

function buildOutlierSummaryCounts(rows, method, grouping) {
  const cleanedRows = cleanRowsForOutlierOption(rows, method, grouping)

  return OUTLIER_REPORT_COLUMNS.reduce((counts, column) => {
    counts[column] = rows.reduce((total, row, index) => {
      const originalValue = toFiniteNumber(row[column])
      if (originalValue === null) {
        return total
      }

      const cleanedValue = toFiniteNumber(cleanedRows[index]?.[column])
      return total + (cleanedValue === null ? 1 : 0)
    }, 0)
    return counts
  }, {})
}

function cleanRowsForOutlierOption(rows, method, grouping) {
  const cleanedRows = rows.map((row) => ({ ...row }))
  const partitions = outlierPartitions(rows, method, grouping)

  partitions.forEach((indexes) => {
    const stats = OUTLIER_REMOVAL_COLUMNS.reduce((accumulator, column) => {
      const values = indexes
        .map((index) => toFiniteNumber(rows[index][column]))
        .filter((value) => value !== null)

      accumulator[column] = {
        mean: values.length ? Math.abs(meanValues(values)) : null,
        sd: sampleStandardDeviation(values),
      }
      return accumulator
    }, {})

    indexes.forEach((index) => {
      OUTLIER_REMOVAL_COLUMNS.forEach((column) => {
        const value = toFiniteNumber(cleanedRows[index][column])
        const columnMean = stats[column].mean
        const columnSd = stats[column].sd

        if (value === null || columnMean === null || columnSd === null) {
          return
        }

        if (value > columnMean + (3 * columnSd) || value < columnMean - (3 * columnSd)) {
          cleanedRows[index][column] = null
        }
      })
    })
  })

  cleanedRows.forEach((row) => {
    const hasPrimaryNa = PRIMARY_METABOLIC_COLUMNS.some((column) => toFiniteNumber(row[column]) === null)
    if (!hasPrimaryNa) {
      return
    }

    PRIMARY_METABOLIC_COLUMNS.forEach((column) => {
      row[column] = null
    })
  })

  return cleanedRows
}

function outlierPartitions(rows, method, grouping) {
  if (method === 'default') {
    return [rows.map((_, index) => index)]
  }

  if (method === 'individual phase') {
    const phaseRows = rowsWithOutlierPhases(rows)
    const keyFor = grouping === 'subject'
      ? (entry) => `${entry.row['subject.id']}::${entry.phase}`
      : (entry) => `${entry.phase}`
    return partitionIndexes(phaseRows, keyFor)
  }

  if (method === 'all light/all dark') {
    const keyFor = grouping === 'subject'
      ? (entry) => `${entry.row.light}::${entry.row['subject.id']}`
      : (entry) => `${entry.row.light}`
    return partitionIndexes(rows.map((row, index) => ({ row, index })), keyFor)
  }

  return [rows.map((_, index) => index)]
}

function rowsWithOutlierPhases(rows) {
  const bySubject = new Map()

  rows.forEach((row, index) => {
    const subjectId = row['subject.id']
    if (!bySubject.has(subjectId)) {
      bySubject.set(subjectId, [])
    }
    bySubject.get(subjectId).push({ row, index })
  })

  const phasedRows = []

  bySubject.forEach((subjectRows) => {
    subjectRows.sort((left, right) => {
      const minuteDiff = (toFiniteNumber(left.row['exp.minute']) ?? 0) - (toFiniteNumber(right.row['exp.minute']) ?? 0)
      if (minuteDiff) {
        return minuteDiff
      }
      return String(left.row['Date.Time'] || left.row['Time.Date'] || '').localeCompare(String(right.row['Date.Time'] || right.row['Time.Date'] || ''))
    })

    let phase = 0
    let previousLight = Symbol('none')

    subjectRows.forEach((entry) => {
      const light = entry.row.light
      if (light !== previousLight) {
        phase += 1
        previousLight = light
      }
      phasedRows.push({ ...entry, phase })
    })
  })

  return phasedRows
}

function partitionIndexes(entries, keyFor) {
  const partitions = new Map()

  entries.forEach((entry) => {
    const key = keyFor(entry)
    if (!partitions.has(key)) {
      partitions.set(key, [])
    }
    partitions.get(key).push(entry.index)
  })

  return [...partitions.values()]
}

function buildDistributionPlotDownloadRows(ctx) {
  return buildDistributionPeriodRows(ctx).map((row) => orderDistributionPlotDataRow(row))
}

function buildDistributionOverallAverageDownloadRows(ctx) {
  const periodOrder = ['Dark', 'Light', 'Total']
  return buildDistributionPeriodRows(ctx)
    .sort((left, right) => {
      const subjectDiff = String(left['subject.id']).localeCompare(String(right['subject.id']))
      if (subjectDiff) {
        return subjectDiff
      }

      return periodOrder.indexOf(left.period) - periodOrder.indexOf(right.period)
    })
    .map((row, index) => orderDistributionOverallAverageRow(ctx, row, index))
}

function buildDistributionPeriodRows(ctx) {
  const rows = ctx.analysisOptions.removeOutliers ? applyDefaultOutlierRemoval(ctx.analysisRows) : ctx.analysisRows
  const rangedRows = filterRowsForBoxDownload(ctx, rows)
  const hourlyRows = buildDistributionHourlyRows(rangedRows)
  const buckets = new Map()
  const periodDescriptors = [
    { period: 'Total', include: () => true },
    { period: 'Dark', include: (row) => Number(row.light) === 0 },
    { period: 'Light', include: (row) => Number(row.light) === 1 },
  ]

  hourlyRows.forEach((row) => {
    periodDescriptors.forEach(({ period, include }) => {
      if (!include(row)) {
        return
      }

      const key = `${period}::${row.group}::${row['subject.id']}`
      if (!buckets.has(key)) {
        buckets.set(key, {
          period,
          group: row.group,
          'subject.id': row['subject.id'],
          hourlyRows: [],
        })
      }

      buckets.get(key).hourlyRows.push(row)
    })
  })

  const periodOrder = ['Total', 'Dark', 'Light']
  return [...buckets.values()]
    .map((bucket) => summarizeDistributionPeriodBucket(bucket))
    .sort((left, right) => {
      const periodDiff = periodOrder.indexOf(left.period) - periodOrder.indexOf(right.period)
      if (periodDiff) {
        return periodDiff
      }

      const groupDiff = String(left.group).localeCompare(String(right.group))
      if (groupDiff) {
        return groupDiff
      }

      return String(left['subject.id']).localeCompare(String(right['subject.id']))
    })
}

function filterRowsForBoxDownload(ctx, rows) {
  const rangeStart = Number(ctx.timeOptions.rangeStart)
  const rangeEnd = Math.min(Number(ctx.timeOptions.rangeEnd), Number(ctx.maxHour))

  return rows.filter((row) => {
    const hour = toFiniteNumber(row['exp.hour'] ?? row.hour)
    return hour !== null && hour >= rangeStart && hour < rangeEnd
  })
}

function buildDistributionHourlyRows(rows) {
  const variables = distributionDownloadVariables()
  const buckets = new Map()
  const minuteBin = computeMinuteBin(rows)
  const subjectBaselines = computeSubjectBaselines(rows, ['pedmeter', 'allmeter'])

  rows.forEach((row) => {
    const subjectId = row['subject.id']
    const group = row.groupName || row.group || 'Unknown'
    const hour = Math.floor(toFiniteNumber(row['exp.hour'] ?? row.hour) ?? 0)
    const key = `${subjectId}::${group}::${hour}`

    if (!buckets.has(key)) {
      buckets.set(key, {
        group,
        'subject.id': subjectId,
        light: [],
        hourValues: [],
        minuteValues: [],
        dateTimeValues: [],
        values: Object.fromEntries(variables.map((variable) => [variable, []])),
      })
    }

    const bucket = buckets.get(key)
    const light = resolveLightValue(row)
    if (light !== null) {
      bucket.light.push(light)
    }

    pushTimestampValue(bucket.hourValues, row.hour)
    pushTimestampValue(bucket.minuteValues, row.minute ?? row['Date.Time'] ?? row['Time.Date'])
    pushTimestampValue(bucket.dateTimeValues, row['Date.Time'] ?? row['Time.Date'])

    variables.forEach((variable) => {
      const value = distributionVariableValue(row, variable, minuteBin, subjectBaselines)
      if (value !== null) {
        bucket.values[variable].push(value)
      }
    })
  })

  return [...buckets.values()].map((bucket) => {
    const row = {
      group: bucket.group,
      'subject.id': bucket['subject.id'],
      light: bucket.light.length ? meanValues(bucket.light) : '',
      hour: meanTimestampValues(bucket.hourValues),
      minute: meanTimestampValues(bucket.minuteValues),
      'Date.Time.mean': meanTimestampValues(bucket.dateTimeValues),
      'Date.Time.sem': sampleTimestampSem(bucket.dateTimeValues),
    }

    variables.forEach((variable) => {
      const values = bucket.values[variable]
      row[`${variable}.mean`] = values.length ? meanValues(values) : ''
      row[`${variable}.sem`] = values.length ? sampleSem(values) : ''
    })

    return row
  })
}

function summarizeDistributionPeriodBucket(bucket) {
  const row = {
    group: bucket.group,
    'subject.id': bucket['subject.id'],
    period: bucket.period,
    light: meanColumn(bucket.hourlyRows, 'light'),
    hour: meanTimestampValues(bucket.hourlyRows.map((entry) => entry.hour)),
    minute: meanTimestampValues(bucket.hourlyRows.map((entry) => entry.minute)),
    'Date.Time.mean': meanTimestampValues(bucket.hourlyRows.map((entry) => entry['Date.Time.mean'])),
    'Date.Time.sem': meanColumn(bucket.hourlyRows, 'Date.Time.sem'),
  }

  distributionDownloadVariables().forEach((variable) => {
    row[`${variable}.mean`] = meanColumn(bucket.hourlyRows, `${variable}.mean`)
    row[`${variable}.sem`] = meanColumn(bucket.hourlyRows, `${variable}.sem`)
  })

  if (row.minute) {
    row['minute.mean'] = row.minute
    row['minute.sem'] = row['Date.Time.sem']
  }

  return row
}

function distributionVariableValue(row, variable, minuteBin = 1, subjectBaselines = new Map()) {
  if (variable === 'feed' || variable === 'drink') {
    const value = toFiniteNumber(row[variable])
    return value === null ? null : value * minuteBin
  }

  if (variable === 'pedmeter' || variable === 'allmeter') {
    const value = toFiniteNumber(row[variable])
    return value === null ? null : value - (subjectBaselines.get(row['subject.id'])?.[variable] ?? 0)
  }

  if (variable === 'eb') {
    const explicit = toFiniteNumber(row.eb)
    if (explicit !== null) {
      return explicit
    }

    const feed = toFiniteNumber(row.feed)
    const ee = toFiniteNumber(row.ee)
    return feed === null || ee === null ? null : feed - ee
  }

  if (variable === 'eb.acc') {
    const explicit = toFiniteNumber(row['eb.acc'])
    if (explicit !== null) {
      return explicit
    }

    const feedAcc = toFiniteNumber(row['feed.acc'])
    const eeAcc = toFiniteNumber(row['ee.acc'])
    return feedAcc === null || eeAcc === null ? null : feedAcc - eeAcc
  }

  if (variable === 'X') {
    return toFiniteNumber(row.X ?? row[''])
  }

  return toFiniteNumber(row[variable])
}

function resolveLightValue(row) {
  const explicit = toFiniteNumber(row.light)
  if (explicit !== null) {
    return explicit
  }

  const enviroLight = toFiniteNumber(row['enviro.light'])
  if (enviroLight === null) {
    return null
  }

  return enviroLight > 1 ? 1 : 0
}

function distributionDownloadVariables() {
  return [
    'feed',
    'drink',
    'ee',
    'feed.acc',
    'drink.acc',
    'pedmeter',
    'allmeter',
    'ee.acc',
    'X',
    'subject.mass',
    'cage',
    'vo2',
    'vco2',
    'rer',
    'xytot',
    'wheel.acc',
    'body.temp',
    'exp.hour',
    'exp.day',
    'minute',
    'exp.minute',
    'eb',
    'eb.acc',
  ]
}

function orderDistributionPlotDataRow(row) {
  return pickOrdered(row, [
    'group',
    'subject.id',
    'period',
    'light',
    'hour',
    'feed.mean',
    'drink.mean',
    'ee.mean',
    'feed.acc.mean',
    'drink.acc.mean',
    'pedmeter.mean',
    'allmeter.mean',
    'ee.acc.mean',
    'X.mean',
    'subject.mass.mean',
    'cage.mean',
    'Date.Time.mean',
    'vo2.mean',
    'vco2.mean',
    'rer.mean',
    'xytot.mean',
    'wheel.acc.mean',
    'body.temp.mean',
    'exp.hour.mean',
    'exp.day.mean',
    'minute.mean',
    'exp.minute.mean',
    'eb.mean',
    'eb.acc.mean',
    'feed.sem',
    'drink.sem',
    'ee.sem',
    'feed.acc.sem',
    'drink.acc.sem',
    'pedmeter.sem',
    'allmeter.sem',
    'ee.acc.sem',
    'X.sem',
    'subject.mass.sem',
    'cage.sem',
    'Date.Time.sem',
    'vo2.sem',
    'vco2.sem',
    'rer.sem',
    'xytot.sem',
    'wheel.acc.sem',
    'body.temp.sem',
    'exp.hour.sem',
    'exp.day.sem',
    'minute.sem',
    'exp.minute.sem',
    'eb.sem',
    'eb.acc.sem',
  ])
}

function orderDistributionOverallAverageRow(ctx, row, index) {
  return {
    '': index + 1,
    'Subject ID': row['subject.id'],
    'Total.Mass': subjectTotalMass(ctx, row['subject.id']) ?? row['subject.mass.mean'],
    'Time of Day': row.period,
    Group: row.group,
    'Time of Day.1': row.light,
    'Energy Expenditure (kcal/hr)': row['ee.mean'],
    'Pedestrian Locomotion (m/hr)': row['pedmeter.mean'],
    'Distance in Cage Locomotion (m/hr)': row['allmeter.mean'],
    'Oxygen Consumption (ml/hr)': row['vo2.mean'],
    'Carbon Dioxide Production (ml/hr)': row['vco2.mean'],
    'Respiratory Exchange Ratio': row['rer.mean'],
    'Locomotor Activity (beam breaks/hr)': row['xytot.mean'],
    'Body Temperature (celsuis)': row['body.temp.mean'],
  }
}

function buildRegressionPlotDownloadRows(ctx) {
  const variables = availableDownloadVariables(ctx, [
    ...ctx.regressionYVariables,
    { field: 'eb' },
    { field: 'rer' },
    { field: 'feed.acc' },
    { field: 'xytot' },
    { field: 'body.temp' },
  ])
  const rowsBySubject = new Map()

  variables.forEach((field) => {
    buildRegressionDataset(ctx.analysisRows, {
      ...ctx.regressionOptions,
      yVar: field,
      removeOutliers: ctx.analysisOptions.removeOutliers,
      hourRange: ctx.sessionMetadata.hour_range,
    }).forEach((row) => {
      const subjectId = row['subject.id']
      if (!rowsBySubject.has(subjectId)) {
        rowsBySubject.set(subjectId, {
          plot: 'regression',
          period: ctx.regressionOptions.period,
          xVar: ctx.regressionOptions.xVar,
          removeOutliers: ctx.analysisOptions.removeOutliers,
          'subject.id': subjectId,
          group: row.groupName,
          weightVar: row.x,
        })
      }

      rowsBySubject.get(subjectId)[`${field}.mean`] = row.y
    })
  })

  return [...rowsBySubject.values()]
}

function buildWeightPlotDownloadRows(ctx) {
  const mode = ctx.weightHasCompositionData ? ctx.weightViewTab : 'total'
  return buildWeightDataset(ctx.analysisRows, { mode }).map((row) => ({
    plot: 'weight',
    mode,
    ...row,
  }))
}

function buildQcPlotDownloadRows(ctx) {
  const rows = ctx.analysisOptions.removeOutliers ? applyDefaultOutlierRemoval(ctx.analysisRows) : ctx.analysisRows
  const rangedRows = filterRowsForQcDownload(ctx, rows)
  const rowsBySubject = new Map()

  rangedRows.forEach((row) => {
    const subjectId = row['subject.id']
    if (subjectId === null || subjectId === undefined || subjectId === '') {
      return
    }

    if (!rowsBySubject.has(`${subjectId}`)) {
      rowsBySubject.set(`${subjectId}`, [])
    }

    rowsBySubject.get(`${subjectId}`).push(row)
  })

  const backendSubjects = new Map((ctx.xp.qcResults?.subjects || []).map((row) => [`${row.subject}`, row]))
  const repSize = clampInteger(ctx.qcOptions.nMassMeasurements, 1, 15, 5)

  return [...rowsBySubject.entries()]
    .map(([subjectId, subjectRows]) => buildQcSubjectDownloadRow(ctx, subjectId, subjectRows, repSize, backendSubjects.get(subjectId)))
    .filter(Boolean)
    .sort((left, right) => {
      const groupDiff = String(left.group).localeCompare(String(right.group))
      if (groupDiff) {
        return groupDiff
      }

      return String(left.subject).localeCompare(String(right.subject))
    })
    .map((row) => orderQcPlotDataRow(row))
}

function filterRowsForQcDownload(ctx, rows) {
  const rangeStart = Number(ctx.qcOptions.hourStart)
  const rangeEnd = Math.min(Number(ctx.qcOptions.hourEnd), Number(ctx.maxHour))
  const subjectsById = sessionSubjectsById(ctx)

  return rows.filter((row) => {
    const hour = toFiniteNumber(row['exp.hour'] ?? row.hour)
    if (hour === null || hour < rangeStart || hour >= rangeEnd) {
      return false
    }

    const subject = subjectsById.get(`${row['subject.id']}`)
    const exclusionHour = toFiniteNumber(subject?.exc_hour)
    return exclusionHour === null || hour < exclusionHour
  })
}

function buildQcSubjectDownloadRow(ctx, subjectId, subjectRows, repSize, backendSubject = null) {
  const sortedRows = [...subjectRows].sort((left, right) => {
    const minuteDiff = (toFiniteNumber(left['exp.minute']) ?? 0) - (toFiniteNumber(right['exp.minute']) ?? 0)
    if (minuteDiff) {
      return minuteDiff
    }

    return String(left['Date.Time'] || left['Time.Date'] || '').localeCompare(String(right['Date.Time'] || right['Time.Date'] || ''))
  })

  if (!sortedRows.length) {
    return null
  }

  const firstRows = sortedRows.slice(0, repSize)
  const lastRows = sortedRows.slice(Math.max(sortedRows.length - repSize, 0))
  const firstSummary = summarizeQcRows(firstRows)
  const lastSummary = summarizeQcRows(lastRows)
  if (repSize !== 1) {
    const lastEbAcc = toFiniteNumber(sortedRows[sortedRows.length - 1]?.['eb.acc'])
    if (lastEbAcc !== null) {
      lastSummary['eb.acc.mean'] = lastEbAcc
    }
  }

  const sessionSubject = sessionSubjectsById(ctx).get(`${subjectId}`)
  const massChange = toFiniteNumber(sessionSubject?.mass_change)
    ?? toFiniteNumber(backendSubject?.mass_delta)
    ?? (
      toFiniteNumber(lastSummary['subject.mass.mean']) !== null && toFiniteNumber(firstSummary['subject.mass.mean']) !== null
        ? toFiniteNumber(lastSummary['subject.mass.mean']) - toFiniteNumber(firstSummary['subject.mass.mean'])
        : ''
    )

  return {
    'f.subject.mass.mean': firstSummary['subject.mass.mean'],
    'f.eb.acc.mean': firstSummary['eb.acc.mean'],
    'f.exp.minute.mean': firstSummary['exp.minute.mean'],
    'f.exp.hour.mean': firstSummary['exp.hour.mean'],
    'f.exp.day.mean': firstSummary['exp.day.mean'],
    'f.wheel.mean': firstSummary['wheel.mean'],
    'f.wheel.acc.mean': firstSummary['wheel.acc.mean'],
    subject: subjectId,
    group: firstRows[0]?.groupName || firstRows[0]?.group || backendSubject?.group || '',
    'l.group': '',
    'l.subject.mass.mean': lastSummary['subject.mass.mean'],
    'l.eb.acc.mean': lastSummary['eb.acc.mean'],
    'l.exp.minute.mean': lastSummary['exp.minute.mean'],
    'l.exp.hour.mean': lastSummary['exp.hour.mean'],
    'l.exp.day.mean': lastSummary['exp.day.mean'],
    'l.wheel.mean': lastSummary['wheel.mean'],
    'l.wheel.acc.mean': lastSummary['wheel.acc.mean'],
    massDelta: massChange,
  }
}

function summarizeQcRows(rows) {
  return ['subject.mass', 'eb.acc', 'exp.minute', 'exp.hour', 'exp.day', 'wheel', 'wheel.acc'].reduce((summary, field) => {
    const values = rows
      .map((row) => distributionVariableValue(row, field))
      .filter((value) => value !== null)
    summary[`${field}.mean`] = values.length ? meanValues(values) : ''
    return summary
  }, {})
}

function orderQcPlotDataRow(row) {
  return pickOrdered(row, [
    'f.subject.mass.mean',
    'f.eb.acc.mean',
    'f.exp.minute.mean',
    'f.exp.hour.mean',
    'f.exp.day.mean',
    'f.wheel.mean',
    'f.wheel.acc.mean',
    'subject',
    'group',
    'l.group',
    'l.subject.mass.mean',
    'l.eb.acc.mean',
    'l.exp.minute.mean',
    'l.exp.hour.mean',
    'l.exp.day.mean',
    'l.wheel.mean',
    'l.wheel.acc.mean',
    'massDelta',
  ])
}

function buildPowerPlotDownloadRows(ctx) {
  return (ctx.xp.powerResults?.power_curve || []).map((row) => ({
    plot: 'power',
    'sample.size': row['sample.size'] ?? row.n_per_group ?? row.sample_size ?? row.n,
    power: row.power,
    ...row,
  }))
}

function buildAncovaSummaryDownloadRows(ctx) {
  const result = ctx.xp.ancovaResults
  if (!result) {
    return []
  }

  const flattenSummaryRows = (rows, analysisType) => (rows || []).flatMap((row) => {
    const periods = Object.entries(row || {}).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
    return periods.flatMap(([period, effects]) =>
      Object.entries(effects || {}).map(([effect, pValue]) => ({
        plot: 'ancova',
        rowType: 'summary',
        analysisType,
        variable: row.variable,
        label: row.label || lookupVariableLabel(ctx, row.variable),
        period,
        effect,
        pValue,
      })),
    )
  })

  return [
    ...flattenSummaryRows(result.ancova || [], 'ancova'),
    ...flattenSummaryRows(result.anova || [], 'anova'),
  ]
}

function buildAncovaPostHocDownloadRows(ctx) {
  const result = ctx.xp.ancovaResults
  if (!result) {
    return []
  }

  const flattenPairwiseRows = (sections, analysisType) => (sections || []).flatMap((section) =>
    flattenAncovaRows(ctx, section.rows || [], analysisType).map((row) => ({
      ...row,
      rowType: 'post_hoc',
      comparison: section.comparison || section.label || '',
    })),
  )

  return [
    ...flattenPairwiseRows(result.ancova_pairwise || [], 'ancova'),
    ...flattenPairwiseRows(result.anova_pairwise || [], 'anova'),
  ]
}

function buildAncovaDownloadRows(ctx) {
  return [
    ...buildAncovaSummaryDownloadRows(ctx),
    ...buildAncovaPostHocDownloadRows(ctx),
  ]
}

function flattenAncovaRows(ctx, rows, analysisType) {
  return (rows || []).flatMap((row) => {
    const periods = Object.entries(row || {}).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
    return periods.flatMap(([period, effects]) =>
      Object.entries(effects || {}).map(([effect, pValue]) => ({
        plot: 'ancova',
        rowType: 'summary',
        analysisType,
        variable: row.variable,
        label: row.label || lookupVariableLabel(ctx, row.variable),
        period,
        effect,
        pValue,
      })),
    )
  })
}

function availableDownloadVariables(ctx, catalog = []) {
  const seen = new Set()
  return catalog
    .map((variable) => variable.field || variable)
    .filter((field) => {
      if (!field || seen.has(field)) {
        return false
      }

      seen.add(field)
      if (field === 'eb' || field === 'eb.acc') {
        return true
      }

      return ctx.analysisRows.some((row) => toFiniteNumber(row[field]) !== null)
    })
}

function timeDownloadVariables(ctx) {
  return availableDownloadVariables(ctx, [
    { field: 'subject.mass' },
    ...ctx.timeSeriesVariableCatalog,
    { field: 'exp.hour' },
    { field: 'exp.day' },
    { field: 'exp.minute' },
  ])
}

function orderTimePlotDataRow(row) {
  return pickOrdered(row, [
    'group',
    'day',
    'light',
    'hour',
    'minute',
    'X.mean',
    'subject.mass.mean',
    'Date.Time.mean',
    'vo2.mean',
    'vco2.mean',
    'rer.mean',
    'xytot.mean',
    'xyamb.mean',
    'wheel.mean',
    'wheel.acc.mean',
    'body.temp.mean',
    'exp.hour.mean',
    'exp.day.mean',
    'exp.minute.mean',
    'feed.mean',
    'drink.mean',
    'ee.mean',
    'feed.acc.mean',
    'drink.acc.mean',
    'pedmeter.mean',
    'allmeter.mean',
    'ee.acc.mean',
    'eb.mean',
    'eb.acc.mean',
    'X.sem',
    'subject.mass.sem',
    'Date.Time.sem',
    'vo2.sem',
    'vco2.sem',
    'rer.sem',
    'xytot.sem',
    'xyamb.sem',
    'wheel.sem',
    'wheel.acc.sem',
    'body.temp.sem',
    'exp.hour.sem',
    'exp.day.sem',
    'exp.minute.sem',
    'feed.sem',
    'drink.sem',
    'ee.sem',
    'feed.acc.sem',
    'drink.acc.sem',
    'pedmeter.sem',
    'allmeter.sem',
    'ee.acc.sem',
    'eb.sem',
    'eb.acc.sem',
    'alexstime',
    'exp.rollmean.mean',
    'exp.rollmean.sem',
  ])
}

function filterRowsByHourRange(rows, start, end) {
  const rangeStart = Number(start)
  const rangeEnd = Number(end)
  return rows.filter((row) => {
    const hour = toFiniteNumber(row.hour ?? row['exp.hour'])
    return hour !== null && hour >= rangeStart && hour <= rangeEnd
  })
}

function renameAggregateColumns(rows) {
  return rows.map((row) => Object.entries(row || {}).reduce((accumulator, [key, value]) => {
    const normalizedKey = key.endsWith('.x')
      ? key.replace(/\.x$/, '.mean')
      : key.endsWith('.y')
        ? key.replace(/\.y$/, '.sem')
        : key

    accumulator[normalizedKey] = value
    return accumulator
  }, {}))
}

function pickOrdered(row, orderedKeys) {
  const ordered = {}
  orderedKeys.forEach((key) => {
    ordered[key] = row[key] ?? ''
  })
  return ordered
}

function sampleSem(values) {
  if (values.length <= 1) {
    return 0
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance) / Math.sqrt(values.length)
}

function sampleStandardDeviation(values) {
  if (values.length <= 1) {
    return 0
  }

  const mean = meanValues(values)
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function meanValues(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function modeValue(values) {
  if (!values.length) {
    return null
  }

  const counts = new Map()
  let bestValue = values[0]
  let bestCount = 0

  values.forEach((value) => {
    const count = (counts.get(value) || 0) + 1
    counts.set(value, count)

    if (count > bestCount) {
      bestCount = count
      bestValue = value
    }
  })

  return bestValue
}

function computeMinuteBin(rows) {
  const minutes = rows
    .map((row) => toFiniteNumber(row['exp.minute']))
    .filter((value) => value !== null)
    .sort((left, right) => left - right)

  if (minutes.length < 2) {
    return 1
  }

  const diffs = []

  for (let index = 1; index < minutes.length; index += 1) {
    const diffMinutes = minutes[index] - minutes[index - 1]
    if (diffMinutes > 0) {
      diffs.push(diffMinutes)
    }
  }

  const modeDiffMinutes = modeValue(diffs)
  return modeDiffMinutes ? 60 / modeDiffMinutes : 1
}

function computeSubjectBaselines(rows, variables) {
  const baselines = new Map()

  rows
    .slice()
    .sort((left, right) => {
      const minuteDiff = (toFiniteNumber(left['exp.minute']) ?? 0) - (toFiniteNumber(right['exp.minute']) ?? 0)
      if (minuteDiff) {
        return minuteDiff
      }

      return String(left['Date.Time'] || left['Time.Date'] || '').localeCompare(String(right['Date.Time'] || right['Time.Date'] || ''))
    })
    .forEach((row) => {
      const subjectId = row['subject.id']
      if (!subjectId) {
        return
      }

      if (!baselines.has(subjectId)) {
        baselines.set(subjectId, {})
      }

      const subjectBaselines = baselines.get(subjectId)
      variables.forEach((variable) => {
        if (subjectBaselines[variable] !== undefined) {
          return
        }

        const value = toFiniteNumber(row[variable])
        if (value !== null) {
          subjectBaselines[variable] = value
        }
      })
    })

  return baselines
}

function meanColumn(rows, key) {
  const values = rows
    .map((row) => toFiniteNumber(row[key]))
    .filter((value) => value !== null)
  return values.length ? meanValues(values) : ''
}

function pushTimestampValue(values, value) {
  if (value === null || value === undefined || value === '') {
    return
  }

  values.push(value)
}

function meanTimestampValues(values) {
  const parsedTimes = values
    .map((value) => toTimestampMs(value))
    .filter((value) => value !== null)
  if (parsedTimes.length) {
    return formatTimestamp(meanValues(parsedTimes))
  }

  const numericValues = values
    .map((value) => toFiniteNumber(value))
    .filter((value) => value !== null)
  return numericValues.length ? meanValues(numericValues) : ''
}

function sampleTimestampSem(values) {
  const parsedTimes = values
    .map((value) => toTimestampMs(value))
    .filter((value) => value !== null)
  if (!parsedTimes.length) {
    return ''
  }

  return sampleSem(parsedTimes) / 1000
}

function toTimestampMs(value) {
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const parsed = new Date(normalized)
  const time = parsed.getTime()
  return Number.isFinite(time) ? time : null
}

function formatTimestamp(timestampMs) {
  const date = new Date(timestampMs)
  if (!Number.isFinite(date.getTime())) {
    return ''
  }

  const pad = (value) => `${value}`.padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function subjectTotalMass(ctx, subjectId) {
  const subject = sessionSubjectsById(ctx).get(`${subjectId}`)
  if (!subject) {
    return null
  }

  return toFiniteNumber(subject.total_mass ?? subject.mass ?? subject.subject_mass)
}

function sessionSubjectsById(ctx) {
  return (ctx.sessionMetadata.subjects || []).reduce((subjects, subject) => {
    const subjectId = subject.subject ?? subject.id ?? subject.subject_id ?? subject['subject.id']
    if (subjectId !== null && subjectId !== undefined && subjectId !== '') {
      subjects.set(`${subjectId}`, subject)
    }

    return subjects
  }, new Map())
}

function lookupVariableLabel(ctx, variable) {
  const labelMaps = [
    ...ctx.explorerVariables,
    ...ctx.regressionYVariables,
    ...ctx.regressionXVariables,
  ]

  return labelMaps.find((entry) => entry.field === variable)?.label || variable
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10)
  if (!Number.isFinite(number)) {
    return fallback
  }

  return Math.min(max, Math.max(min, number))
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function sanitizeDownloadIdentifier(value) {
  return `${value || 'analysis'}`
    .trim()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'analysis'
}
