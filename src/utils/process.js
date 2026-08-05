// Shared CALR/session processing helpers.
// This file owns generic normalization, enrichment, accumulator repair, filtering,
// and aggregation utilities that can be reused outside any specific plot.
const DEFAULT_LIGHT_CYCLE_START = 7
const DEFAULT_DARK_CYCLE_START = 19

export const DEFAULT_GROUP_COLORS = ['#3B73C7', '#ED5F00', '#2F9E44', '#7A52A5']

let defaultOutlierRemovalCache = new WeakMap()
let aggregateDetailRowsCache = new WeakMap()

export function clearProcessCaches() {
  defaultOutlierRemovalCache = new WeakMap()
  aggregateDetailRowsCache = new WeakMap()
}

function isBlank(value) {
  return value === null || value === undefined || `${value}`.trim() === '' || `${value}`.trim().toUpperCase() === 'NA'
}

function toNullableNumber(value) {
  if (isBlank(value)) {
    return null
  }

  const number = Number(value)
  return Number.isNaN(number) ? null : number
}

function sortSubjects(subjects) {
  return [...subjects].sort((left, right) =>
    String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  )
}

function normalizeSubjectIdentifier(value) {
  if (isBlank(value)) {
    return ''
  }

  return `${value}`.trim()
}

function subjectIdentifierCandidates(value) {
  const normalized = normalizeSubjectIdentifier(value)

  if (!normalized) {
    return []
  }

  const candidates = [normalized]

  if (normalized.includes('_')) {
    const parts = normalized.split('_')
    const suffix = parts[parts.length - 1]
    if (suffix && suffix !== normalized) {
      candidates.push(suffix)
    }
  }

  return [...new Set(candidates)]
}

function setMapValueList(map, key, value) {
  if (!key) {
    return
  }

  if (!map.has(key)) {
    map.set(key, [])
  }

  map.get(key).push(value)
}

function getBestMappedValue(map, value) {
  const candidates = subjectIdentifierCandidates(value)

  for (const candidate of candidates) {
    const matches = map.get(candidate)
    if (Array.isArray(matches) && matches.length) {
      return matches[0]
    }
    if (matches !== undefined) {
      return matches
    }
  }

  return undefined
}

function findTimeKey(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return null
  }

  if (rows[0]['Date.Time'] !== undefined) {
    return 'Date.Time'
  }

  if (rows[0]['Time.Date'] !== undefined) {
    return 'Time.Date'
  }

  return null
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

function maxValue(values) {
  if (!values.length) {
    return null
  }

  return values.reduce((current, value) => (current === null || value > current ? value : current), null)
}

function sumValues(values) {
  if (!values.length) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0)
}

function standardDeviation(values) {
  if (values.length <= 1) {
    return 0
  }

  const avg = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function mode(values) {
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

function computeMinuteBin(detailRows) {
  const minutes = detailRows
    .map((row) => toNullableNumber(row['exp.minute']))
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

  const modeDiffMinutes = mode(diffs)

  if (!modeDiffMinutes) {
    return 1
  }

  return 60 / modeDiffMinutes
}

function bucketDescriptor(row, per) {
  if (per === 'day') {
    return {
      key: `${row['subject.id']}::${row.day}`,
      label: row.day,
      fields: { day: row.day },
    }
  }

  if (per === 'light') {
    return {
      key: `${row['subject.id']}::${row.day}::${row.light}`,
      label: `${row.day}:${row.light}`,
      fields: { day: row.day, light: row.light },
    }
  }

  if (per === 'hour') {
    const hourBucket = row['exp.hour'] === null ? null : Math.floor(row['exp.hour'])
    return {
      key: `${row['subject.id']}::${hourBucket}`,
      label: hourBucket,
      fields: { hour: hourBucket, light: row.light, day: row.day },
    }
  }

  const minuteBucket = row['exp.minute'] === null ? null : Math.round(row['exp.minute'])
  return {
    key: `${row['subject.id']}::${minuteBucket}`,
    label: minuteBucket,
    fields: { minute: minuteBucket, hour: row['exp.hour'], light: row.light, day: row.day },
  }
}

function aggregateBucketVariable(variable, values, per) {
  const numericValues = values.filter((value) => value !== null && !Number.isNaN(value))

  if (!numericValues.length) {
    return null
  }

  const useSum = ['feed', 'drink'].includes(variable)
  const useMax = ['feed.acc', 'drink.acc', 'ee.acc', 'eb.acc', 'pedmeter', 'allmeter', 'wheel.acc'].includes(variable)

  if (useMax) {
    return maxValue(numericValues)
  }

  if (useSum) {
    return sumValues(numericValues)
  }

  return mean(numericValues)
}

function convertFeedColumns(row) {
  const dietCal = toNullableNumber(row.dietCal)

  if (dietCal === null) {
    return row
  }

  return {
    ...row,
    feed: row.feed === null || row.feed === undefined ? row.feed : row.feed * dietCal,
    'feed.acc': row['feed.acc'] === null || row['feed.acc'] === undefined ? row['feed.acc'] : row['feed.acc'] * dietCal,
  }
}

function getCachedDerivedRows(cache, rows, cacheKey, computeValue) {
  if (!Array.isArray(rows) || !rows.length) {
    return computeValue()
  }

  if (!cache.has(rows)) {
    cache.set(rows, new Map())
  }

  const cacheEntries = cache.get(rows)

  if (cacheEntries.has(cacheKey)) {
    return cacheEntries.get(cacheKey)
  }

  const value = computeValue()
  cacheEntries.set(cacheKey, value)
  return value
}

export function fillAccumulatorColumns(rows) {
  const rowsBySubject = new Map()
  const minuteBin = computeMinuteBin(rows)

  rows.forEach((row) => {
    const subjectId = normalizeSubjectIdentifier(row['subject.id'] || row.subject_id)

    if (!rowsBySubject.has(subjectId)) {
      rowsBySubject.set(subjectId, [])
    }

    rowsBySubject.get(subjectId).push(row)
  })

  const completedRows = []

  rowsBySubject.forEach((subjectRows) => {
    subjectRows.sort((left, right) => {
      const minuteDiff = (toNullableNumber(left['exp.minute']) ?? 0) - (toNullableNumber(right['exp.minute']) ?? 0)
      if (minuteDiff) {
        return minuteDiff
      }

      return String(left['Date.Time'] || left['Time.Date'] || '').localeCompare(String(right['Date.Time'] || right['Time.Date'] || ''))
    })

    let eeAccRunning = 0
    let ebAccRunning = 0
    const firstExplicitEeAcc = subjectRows.reduce((baseline, row) => {
      if (baseline !== null) {
        return baseline
      }
      return toNullableNumber(row['ee.acc'])
    }, null)
    const firstExplicitFeedAcc = subjectRows.reduce((baseline, row) => {
      if (baseline !== null) {
        return baseline
      }
      return toNullableNumber(row['feed.acc'])
    }, null)
    const firstExplicitEbAcc = subjectRows.reduce((baseline, row) => {
      if (baseline !== null) {
        return baseline
      }
      return toNullableNumber(row['eb.acc'])
    }, null)
    const hasExplicitEbAcc = firstExplicitEbAcc !== null

    subjectRows.forEach((row) => {
      const eeValue = toNullableNumber(row.ee)
      const feedValue = toNullableNumber(row.feed)
      const explicitEeAcc = toNullableNumber(row['ee.acc'])
      const explicitFeedAcc = toNullableNumber(row['feed.acc'])
      const explicitEb = toNullableNumber(row.eb)
      const explicitEbAcc = toNullableNumber(row['eb.acc'])
      const eeAccIncrement = eeValue === null ? null : eeValue / minuteBin
      const feedAccZeroed = explicitFeedAcc === null
        ? null
        : explicitFeedAcc - (firstExplicitFeedAcc ?? 0)
      const nextEeAcc = explicitEeAcc === null
        ? (eeAccIncrement === null ? null : eeAccRunning + eeAccIncrement)
        : hasExplicitEbAcc
          ? explicitEeAcc - (firstExplicitEeAcc ?? 0)
          : (explicitEeAcc - (firstExplicitEeAcc ?? 0)) / minuteBin

      if (nextEeAcc !== null) {
        eeAccRunning = nextEeAcc
      }

      const nextEb = explicitEb ?? (feedValue === null || eeValue === null ? null : (feedValue * minuteBin) - eeValue)
      const ebAccIncrement = feedValue === null || eeAccIncrement === null ? null : feedValue - eeAccIncrement
      const nextEbAcc = explicitEbAcc !== null
        ? explicitEbAcc - (firstExplicitEbAcc ?? 0)
        : feedAccZeroed === null || nextEeAcc === null
          ? (ebAccIncrement === null ? null : ebAccRunning + ebAccIncrement)
          : feedAccZeroed - nextEeAcc

      if (nextEbAcc !== null) {
        ebAccRunning = nextEbAcc
      }

      completedRows.push({
        ...row,
        'feed.acc': feedAccZeroed ?? row['feed.acc'],
        'ee.acc': nextEeAcc,
        eb: nextEb,
        'eb.acc': nextEbAcc,
      })
    })
  })

  return completedRows
}

export function applyDefaultOutlierRemoval(detailRows) {
  if (!Array.isArray(detailRows) || !detailRows.length) {
    return []
  }

  return getCachedDerivedRows(defaultOutlierRemovalCache, detailRows, 'default', () => {
    const rmColumns = ['vo2', 'vco2', 'ee', 'rer', 'body.temp']
    const stats = {}

    rmColumns.forEach((column) => {
      const values = detailRows
        .map((row) => toNullableNumber(row[column]))
        .filter((value) => value !== null)

      stats[column] = {
        mean: mean(values),
        sd: standardDeviation(values),
      }
    })

    const cleaned = detailRows.map((row) => {
      const nextRow = { ...row }

      rmColumns.forEach((column) => {
        const value = toNullableNumber(nextRow[column])
        const columnMean = stats[column].mean
        const columnSd = stats[column].sd

        if (value === null || columnMean === null || !columnSd) {
          return
        }

        const isOutlier = value > (Math.abs(columnMean) + (3 * columnSd)) || value < (Math.abs(columnMean) - (3 * columnSd))

        if (isOutlier) {
          nextRow[column] = null
        }
      })

      const hasPrimaryNa =
        nextRow.vo2 === null
        || nextRow.vco2 === null
        || nextRow.ee === null
        || nextRow.rer === null

      if (hasPrimaryNa) {
        nextRow.vo2 = null
        nextRow.vco2 = null
        nextRow.ee = null
        nextRow.rer = null
      }

      return nextRow
    })

    return fillAccumulatorColumns(cleaned)
  })
}

export function ensureExpMinute(rows) {
  if (!Array.isArray(rows) || !rows.length || rows[0]['exp.minute'] !== undefined) {
    return rows
  }

  const timeKey = findTimeKey(rows)

  if (!timeKey) {
    return rows
  }

  const start = Date.parse(rows[0][timeKey])

  if (Number.isNaN(start)) {
    return rows
  }

  return rows.map((row) => {
    const current = Date.parse(row[timeKey])
    return {
      ...row,
      'exp.minute': Number.isNaN(current) ? null : Math.round((current - start) / 60000),
    }
  })
}

export function ensureEnviroLight(rows, lightStartHour, darkStartHour, lightValue = 5, darkValue = 0) {
  if (!Array.isArray(rows) || !rows.length) {
    return rows
  }

  const timeKey = findTimeKey(rows)

  if (!timeKey) {
    return rows
  }

  return rows.map((row) => {
    const hour = Number(String(row[timeKey] || '').slice(11, 13))
    const isLight = !Number.isNaN(hour) && hour >= Number(lightStartHour) && hour < Number(darkStartHour)

    return {
      ...row,
      'enviro.light': isLight ? lightValue : darkValue,
    }
  })
}

export function getSessionCycleStartsFromRows(rows) {
  const values = rows
    .map((row) => toNullableNumber(row.light))
    .filter((value) => value !== null)

  const lightCycleStart = values[0] ?? DEFAULT_LIGHT_CYCLE_START
  const darkCycleStart = values[1] ?? ((lightCycleStart + 12) % 24 || DEFAULT_DARK_CYCLE_START)

  return {
    lightCycleStart,
    darkCycleStart,
  }
}

export function getLightDarkStartsFromData(rows, threshold = 1) {
  const transitions = []

  for (let index = 1; index < rows.length; index += 1) {
    const previous = Number(rows[index - 1]['enviro.light']) || 0
    const current = Number(rows[index]['enviro.light']) || 0
    const previousState = previous > threshold ? 'light' : 'dark'
    const currentState = current > threshold ? 'light' : 'dark'

    if (previousState !== currentState) {
      const expMinute = Number(rows[index]['exp.minute'])
      if (!Number.isNaN(expMinute)) {
        transitions.push({
          type: currentState,
          hour: ((expMinute / 60) % 24 + 24) % 24,
        })
      }
    }
  }

  const average = (hours) => (hours.length ? Math.round(hours.reduce((sum, hour) => sum + hour, 0) / hours.length) : null)
  let lightCycleStart = average(transitions.filter((item) => item.type === 'light').map((item) => item.hour))
  let darkCycleStart = average(transitions.filter((item) => item.type === 'dark').map((item) => item.hour))

  if (lightCycleStart === null && darkCycleStart !== null) {
    lightCycleStart = (darkCycleStart + 12) % 24
  }

  if (darkCycleStart === null && lightCycleStart !== null) {
    darkCycleStart = (lightCycleStart + 12) % 24
  }

  return {
    lightCycleStart: lightCycleStart ?? DEFAULT_LIGHT_CYCLE_START,
    darkCycleStart: darkCycleStart ?? DEFAULT_DARK_CYCLE_START,
  }
}

export function preprocessSession(rows) {
  const extract = (column) => rows.map((row) => row[column]).filter((value) => !isBlank(value)).map((value) => `${value}`.trim())

  const session = {
    groupNames: extract('group_names'),
    dietNames: extract('diet_names'),
    colors: extract('colors'),
    dietCal: extract('dietCal').map((value) => Number(value)),
    lightDark: extract('light'),
    groups: [],
  }

  const groupColumns = Object.keys(rows[0] || {})
    .filter((key) => /^group\d+$/i.test(key))
    .sort((left, right) => Number(left.replace(/\D/g, '')) - Number(right.replace(/\D/g, '')))

  groupColumns.forEach((column, index) => {
    session.groups[index] = extract(column)
  })

  return session
}

export function applyExclusions(detailRows, session) {
  if (!Array.isArray(detailRows) || !detailRows.length) {
    return []
  }

  const subjectMap = new Map((session.subjects || []).map((subject) => [subject.subject, subject]))

  return detailRows.filter((row) => {
    const subjectId = normalizeSubjectIdentifier(row['subject.id'] || row.subject_id)
    const subject = subjectMap.get(subjectId)
    const expHour = toNullableNumber(row['exp.hour'] ?? row.hour)

    if (!subject || subject.exc_hour === null || expHour === null) {
      return true
    }

    return expHour < subject.exc_hour
  })
}

export function cropDetailRows(detailRows, hourRange) {
  if (!Array.isArray(detailRows) || !detailRows.length || !Array.isArray(hourRange) || hourRange.length !== 2) {
    return detailRows
  }

  const [startHour, endHour] = hourRange

  return detailRows.filter((row) => {
    const expHour = toNullableNumber(row['exp.hour'] ?? row.hour)

    if (expHour === null) {
      return false
    }

    return expHour >= startHour && expHour <= endHour
  })
}

export function aggregateDetailRows(detailRows, {
  per = 'min',
  grp = true,
  variables = null,
} = {}) {
  if (!Array.isArray(detailRows) || !detailRows.length) {
    return []
  }

  const normalizedVariables = variables ? [...new Set(variables)].sort() : null
  const cacheKey = JSON.stringify({
    per,
    grp,
    variables: normalizedVariables,
  })

  return getCachedDerivedRows(aggregateDetailRowsCache, detailRows, cacheKey, () => {
    const minuteBin = computeMinuteBin(detailRows)
    const aggregateVariables = normalizedVariables || Object.keys(detailRows[0]).filter((key) => {
      if (['subject.id', 'groupName', 'groupIndex', 'diet', 'dietCal', 'color', 'subjectSession', 'Date.Time', 'Time.Date'].includes(key)) {
        return false
      }

      return detailRows.some((row) => typeof row[key] === 'number' && !Number.isNaN(row[key]))
    })

    const subjectBuckets = new Map()

    detailRows.forEach((row) => {
      const descriptor = bucketDescriptor(row, per)

      if (descriptor.label === null) {
        return
      }

      if (!subjectBuckets.has(descriptor.key)) {
        subjectBuckets.set(descriptor.key, {
          meta: {
            'subject.id': row['subject.id'],
            groupName: row.groupName || 'Unknown',
            groupIndex: row.groupIndex ?? -1,
            diet: row.diet ?? null,
            dietCal: row.dietCal ?? null,
            color: row.color || '#888',
            light: row.light ?? null,
            day: row.day ?? null,
            hour: row['exp.hour'] ?? row.hour ?? null,
            'exp.hour': row['exp.hour'] ?? row.hour ?? null,
            minute: row['exp.minute'] ?? null,
            'exp.minute': row['exp.minute'] ?? null,
            ...descriptor.fields,
          },
          values: {},
        })
      }

      const bucket = subjectBuckets.get(descriptor.key)

      aggregateVariables.forEach((variable) => {
        const value = row[variable]
        if (typeof value !== 'number' || Number.isNaN(value)) {
          return
        }

        if (!bucket.values[variable]) {
          bucket.values[variable] = []
        }

        bucket.values[variable].push(value)
      })
    })

    const subjectRows = [...subjectBuckets.values()].map((bucket) => {
      const aggregated = { ...bucket.meta }

      aggregateVariables.forEach((variable) => {
        aggregated[variable] = aggregateBucketVariable(variable, bucket.values[variable] || [], per)
      })

      if (per === 'min' && aggregated.feed !== null) {
        aggregated.feed *= minuteBin
      }

      if (aggregated.feed !== null && aggregated.ee !== null) {
        aggregated.eb = aggregated.feed - aggregated.ee
      }

      if (aggregated['eb.acc'] === null && aggregated['feed.acc'] !== null && aggregated['ee.acc'] !== null) {
        aggregated['eb.acc'] = aggregated['feed.acc'] - aggregated['ee.acc']
      }

      return aggregated
    })

    if (!grp) {
      return subjectRows.sort((left, right) => {
        const timeDiff = (left['exp.minute'] ?? 0) - (right['exp.minute'] ?? 0)
        return timeDiff || String(left['subject.id']).localeCompare(String(right['subject.id']))
      })
    }

    const groupBuckets = new Map()

    subjectRows.forEach((row) => {
      const groupKeyParts = [row.groupName || 'Unknown']

      if (per === 'day') {
        groupKeyParts.push(`${row.day}`)
      } else if (per === 'light') {
        groupKeyParts.push(`${row.day}`, `${row.light}`)
      } else if (per === 'hour') {
        groupKeyParts.push(`${Math.floor(row['exp.hour'] ?? row.hour ?? 0)}`)
      } else {
        groupKeyParts.push(`${Math.round(row['exp.minute'] ?? 0)}`)
      }

      const groupKey = groupKeyParts.join('::')

      if (!groupBuckets.has(groupKey)) {
        groupBuckets.set(groupKey, {
          meta: {
            groupName: row.groupName || 'Unknown',
            groupIndex: row.groupIndex ?? -1,
            color: row.color || '#888',
            diet: row.diet ?? null,
            dietCal: row.dietCal ?? null,
            light: row.light ?? null,
            day: row.day ?? null,
            hour: row['exp.hour'] ?? row.hour ?? null,
            'exp.hour': row['exp.hour'] ?? row.hour ?? null,
            minute: row['exp.minute'] ?? null,
            'exp.minute': row['exp.minute'] ?? null,
          },
          values: {},
        })
      }

      const bucket = groupBuckets.get(groupKey)

      aggregateVariables.concat(['eb', 'eb.acc']).forEach((variable) => {
        const value = row[variable]
        if (typeof value !== 'number' || Number.isNaN(value)) {
          return
        }

        if (!bucket.values[variable]) {
          bucket.values[variable] = []
        }

        bucket.values[variable].push(value)
      })
    })

    return [...groupBuckets.values()]
      .map((bucket) => {
        const aggregated = { ...bucket.meta, n: 0 }

        Object.entries(bucket.values).forEach(([variable, values]) => {
          aggregated[`${variable}.x`] = mean(values)
          aggregated[`${variable}.y`] = sampleSem(values)
          aggregated.n = Math.max(aggregated.n, values.length)
        })

        return aggregated
      })
      .sort((left, right) => {
        const timeDiff = (left['exp.minute'] ?? 0) - (right['exp.minute'] ?? 0)
        if (timeDiff) {
          return timeDiff
        }

        return String(left.groupName).localeCompare(String(right.groupName))
      })
  })
}

export function normalizeSessionPayload(payload = {}) {
  const normalizeHourValue = (value, fallback) => {
    const parsed = toNullableNumber(value)
    return parsed === null ? fallback : Math.floor(parsed)
  }

  const groups = (Array.isArray(payload.groups) && payload.groups.length
    ? payload.groups
    : [
        { name: 'WT', diet_name: 'LabDiet 5008', diet_kcal: 3.56 },
        { name: 'KO', diet_name: 'Research Diet 60 kcal% Fat', diet_kcal: 5.21 },
      ]).map((group, index) => ({
    name: `${group?.name || `Group ${index + 1}`}`.trim(),
    diet_name: group?.diet_name ? `${group.diet_name}`.trim() : '',
    diet_kcal: toNullableNumber(group?.diet_kcal),
    color: group?.color || payload.group_colors?.[group?.name] || DEFAULT_GROUP_COLORS[index % DEFAULT_GROUP_COLORS.length],
  }))

  const groupColors = groups.reduce((accumulator, group, index) => {
    accumulator[group.name] = group.color || DEFAULT_GROUP_COLORS[index % DEFAULT_GROUP_COLORS.length]
    return accumulator
  }, {})

  const subjects = sortSubjects(
    (Array.isArray(payload.subjects) ? payload.subjects : []).map((subject) => subject.subject).filter((subject) => !isBlank(subject)),
  ).map((subjectId) => {
    const subject = payload.subjects.find((item) => `${item.subject}` === `${subjectId}`) || {}
    return {
      subject: `${subjectId}`,
      groupIndex: Number.isInteger(subject.groupIndex) ? subject.groupIndex : Math.max(Number(subject.groupIndex) || 0, 0),
      total_mass: toNullableNumber(subject.total_mass),
      lean_mass: toNullableNumber(subject.lean_mass),
      fat_mass: toNullableNumber(subject.fat_mass),
      mass_change: toNullableNumber(subject.mass_change),
      exc_hour: toNullableNumber(subject.exc_hour),
      exc_reason: subject.exc_reason ? `${subject.exc_reason}` : '',
    }
  })

  return {
    groups,
    subjects,
    light_cycle_start: toNullableNumber(payload.light_cycle_start) ?? DEFAULT_LIGHT_CYCLE_START,
    dark_cycle_start: toNullableNumber(payload.dark_cycle_start) ?? DEFAULT_DARK_CYCLE_START,
    hour_range: Array.isArray(payload.hour_range) && payload.hour_range.length === 2
      ? [
          normalizeHourValue(payload.hour_range[0], 0),
          normalizeHourValue(payload.hour_range[1], 24),
        ]
      : [0, 24],
    food_cutoff: toNullableNumber(payload.food_cutoff) ?? 0,
    remove_outliers: Boolean(payload.remove_outliers),
    group_colors: groupColors,
  }
}

export function inferSessionPayloadFromCalrData(rows) {
  const subjects = new Map()
  let minExpMinute = Infinity
  let maxExpMinute = -Infinity

  rows.forEach((row) => {
    const subjectId = row['subject.id']
    if (!isBlank(subjectId) && !subjects.has(`${subjectId}`)) {
      subjects.set(`${subjectId}`, {
        subject: `${subjectId}`,
        groupIndex: 0,
        total_mass: null,
        lean_mass: null,
        fat_mass: null,
        mass_change: null,
        exc_hour: null,
        exc_reason: '',
      })
    }

    const expMinute = Number(row['exp.minute'])
    if (!Number.isNaN(expMinute)) {
      minExpMinute = Math.min(minExpMinute, expMinute)
      maxExpMinute = Math.max(maxExpMinute, expMinute)
    }
  })

  const cycleStarts = rows.some((row) => !isBlank(row['enviro.light']))
    ? getLightDarkStartsFromData(rows)
    : { lightCycleStart: DEFAULT_LIGHT_CYCLE_START, darkCycleStart: DEFAULT_DARK_CYCLE_START }

  return normalizeSessionPayload({
    groups: [],
    subjects: sortSubjects([...subjects.keys()]).map((subject) => subjects.get(subject)),
    light_cycle_start: cycleStarts.lightCycleStart,
    dark_cycle_start: cycleStarts.darkCycleStart,
    hour_range: [
      minExpMinute === Infinity ? 0 : minExpMinute / 60,
      maxExpMinute === -Infinity ? 24 : maxExpMinute / 60,
    ],
    food_cutoff: 0,
    remove_outliers: false,
  })
}

export function mergeSessionCsvIntoPayload(rows, fallbackPayload = {}) {
  const basePayload = normalizeSessionPayload(fallbackPayload)
  const stackedSubjectCount = basePayload.subjects.length
  const groupColumns = Object.keys(rows[0] || {})
    .filter((key) => /^group\d+$/i.test(key))
    .sort((left, right) => Number(left.replace(/\D/g, '')) - Number(right.replace(/\D/g, '')))

  const groupNames = rows
    .map((row) => row.group_names)
    .filter((value) => !isBlank(value))
    .map((value) => `${value}`.trim())

  const dietNames = rows
    .map((row) => row.diet_names)
    .filter((value) => !isBlank(value))
    .map((value) => `${value}`.trim())

  const dietCalories = rows
    .map((row) => toNullableNumber(row.dietCal))
    .filter((value) => value !== null)

  const colors = rows
    .map((row) => row.colors)
    .filter((value) => !isBlank(value))
    .map((value) => `${value}`.trim())

  const xRanges = rows
    .map((row) => toNullableNumber(row.xrange))
    .filter((value) => value !== null)

  const outlierValues = rows
    .map((row) => row.outliers)
    .filter((value) => !isBlank(value))
    .map((value) => `${value}`.trim().toLowerCase())

  const feedCutoffValues = rows
    .map((row) => toNullableNumber(row.feedCutoff ?? row.food_cutoff))
    .filter((value) => value !== null)

  const groups = (groupColumns.length ? groupColumns : basePayload.groups.map((_, index) => `group${index + 1}`))
    .map((_, index) => ({
      name: groupNames[index] || basePayload.groups[index]?.name || `Group ${index + 1}`,
      diet_name: dietNames[index] || basePayload.groups[index]?.diet_name || '',
      diet_kcal: dietCalories[index] ?? basePayload.groups[index]?.diet_kcal ?? null,
      color: colors[index] || basePayload.groups[index]?.color || DEFAULT_GROUP_COLORS[index % DEFAULT_GROUP_COLORS.length],
    }))

  const groupsBySubject = new Map()
  groupColumns.forEach((column, groupIndex) => {
    rows.forEach((row) => {
      const subjectId = row[column]
      if (!isBlank(subjectId)) {
        subjectIdentifierCandidates(subjectId).forEach((candidate) => {
          if (!groupsBySubject.has(candidate)) {
            groupsBySubject.set(candidate, [groupIndex])
          }
        })
      }
    })
  })

  const rowBySubject = new Map()
  const stackedExclusionReasons = new Map()

  if (stackedSubjectCount > 0 && rows.length >= stackedSubjectCount * 2) {
    for (let index = 0; index < stackedSubjectCount; index += 1) {
      const subjectRow = rows[index]
      const reasonRow = rows[index + stackedSubjectCount]
      const subjectId = normalizeSubjectIdentifier(subjectRow?.id)
      const reasonValue = reasonRow?.exc

      if (
        subjectId &&
        !isBlank(reasonValue) &&
        toNullableNumber(reasonValue) === null &&
        isBlank(reasonRow?.id) &&
        isBlank(reasonRow?.['Total.Mass'])
      ) {
        stackedExclusionReasons.set(subjectId, `${reasonValue}`.trim())
      }
    }
  }

  rows.forEach((row) => {
    const subjectId = !isBlank(row.id) ? normalizeSubjectIdentifier(row.id) : null
    if (subjectId) {
      setMapValueList(rowBySubject, subjectId, row)
      subjectIdentifierCandidates(subjectId).forEach((candidate) => {
        setMapValueList(rowBySubject, candidate, row)
      })
    }
  })

  const subjectIds = basePayload.subjects.length
    ? basePayload.subjects.map((subject) => subject.subject)
    : sortSubjects([...new Set([...groupsBySubject.keys(), ...rowBySubject.keys()])])

  const subjects = sortSubjects(subjectIds).map((subjectId) => {
    const baseSubject = basePayload.subjects.find((subject) => subject.subject === subjectId) || {
      subject: subjectId,
      groupIndex: 0,
      total_mass: null,
      lean_mass: null,
      fat_mass: null,
      mass_change: null,
      exc_hour: null,
      exc_reason: '',
    }
    const sourceRow = getBestMappedValue(rowBySubject, subjectId) || {}
    const exclusionValue = sourceRow.exc
    const exclusionNumber = toNullableNumber(exclusionValue)
    const stackedReason = getBestMappedValue(stackedExclusionReasons, subjectId) || ''

    return {
      ...baseSubject,
      subject: subjectId,
      groupIndex: getBestMappedValue(groupsBySubject, subjectId) ?? baseSubject.groupIndex ?? 0,
      total_mass: toNullableNumber(sourceRow['Total.Mass']) ?? baseSubject.total_mass,
      lean_mass: toNullableNumber(sourceRow['Lean.Mass']) ?? baseSubject.lean_mass,
      fat_mass: toNullableNumber(sourceRow['Fat.Mass']) ?? baseSubject.fat_mass,
      mass_change: toNullableNumber(sourceRow['Mass.Change']) ?? baseSubject.mass_change,
      exc_hour: exclusionNumber ?? baseSubject.exc_hour,
      exc_reason: exclusionNumber === null && !isBlank(exclusionValue)
        ? `${exclusionValue}`.trim()
        : (!baseSubject.exc_reason && (exclusionNumber ?? baseSubject.exc_hour) !== null && stackedReason)
            ? stackedReason
        : baseSubject.exc_reason,
    }
  })

  const cycleStarts = rows.length
    ? getSessionCycleStartsFromRows(rows)
    : {
        lightCycleStart: basePayload.light_cycle_start,
        darkCycleStart: basePayload.dark_cycle_start,
      }

  return normalizeSessionPayload({
    ...basePayload,
    groups,
    subjects,
    light_cycle_start: cycleStarts.lightCycleStart ?? basePayload.light_cycle_start,
    dark_cycle_start: cycleStarts.darkCycleStart ?? basePayload.dark_cycle_start,
    hour_range: xRanges.length >= 2
      ? [xRanges[0], xRanges[1]]
      : basePayload.hour_range,
    food_cutoff: feedCutoffValues.length
      ? feedCutoffValues[0]
      : basePayload.food_cutoff,
    remove_outliers: outlierValues.length
      ? outlierValues[0] === 'yes' || outlierValues[0] === 'true'
      : basePayload.remove_outliers,
  })
}
