const DEFAULT_LIGHT_CYCLE_START = 7
const DEFAULT_DARK_CYCLE_START = 19

export const DEFAULT_GROUP_COLORS = ['#3B73C7', '#ED5F00', '#2F9E44', '#7A52A5']

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

function resolveSubjectGroupIndex(subjectIdValue, session) {
  const firstGroupValue = session.groups?.[0]?.[0]
  const useCompoundSubjectId = typeof firstGroupValue === 'string' && firstGroupValue.includes('_')
  const normalizedValue = normalizeSubjectIdentifier(subjectIdValue)

  if (!normalizedValue) {
    return -1
  }

  const targetId = useCompoundSubjectId ? normalizedValue : normalizedValue.split('_')[0]
  return session.groups.findIndex((group) => group.includes(targetId))
}

function computeClockHour(expMinute) {
  if (expMinute === null) {
    return null
  }

  return ((expMinute / 60) % 24 + 24) % 24
}

function computeCycleDay(expMinute, lightCycleStart) {
  if (expMinute === null) {
    return null
  }

  return Math.floor((expMinute / 60 - lightCycleStart) / 24)
}

function applySessionFieldFallbacks(row, subjectSession = {}) {
  return {
    ...row,
    'subject.mass': row['subject.mass'] ?? subjectSession.total_mass ?? null,
    'subject.lean.mass': row['subject.lean.mass'] ?? subjectSession.lean_mass ?? row['Lean.Mass'] ?? null,
    'subject.fat.mass': row['subject.fat.mass'] ?? subjectSession.fat_mass ?? row['Fat.Mass'] ?? null,
  }
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

function quantile(sortedValues, q) {
  if (!sortedValues.length) {
    return null
  }

  const position = (sortedValues.length - 1) * q
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex]
  }

  const weight = position - lowerIndex
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight
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

    subjectRows.forEach((row) => {
      const eeValue = toNullableNumber(row.ee)
      const feedValue = toNullableNumber(row.feed)
      const explicitEeAcc = toNullableNumber(row['ee.acc'])
      const explicitFeedAcc = toNullableNumber(row['feed.acc'])
      const explicitEb = toNullableNumber(row.eb)
      const eeAccIncrement = eeValue === null ? null : eeValue / minuteBin
      const nextEeAcc = explicitEeAcc ?? (eeAccIncrement === null ? null : eeAccRunning + eeAccIncrement)

      if (nextEeAcc !== null) {
        eeAccRunning = nextEeAcc
      }

      const nextEb = explicitEb ?? (feedValue === null || eeValue === null ? null : feedValue - eeValue)
      const ebAccIncrement = feedValue === null || eeAccIncrement === null ? null : feedValue - eeAccIncrement
      const nextEbAcc = explicitFeedAcc === null || nextEeAcc === null
        ? (ebAccIncrement === null ? null : ebAccRunning + ebAccIncrement)
        : explicitFeedAcc - nextEeAcc

      if (nextEbAcc !== null) {
        ebAccRunning = nextEbAcc
      }

      completedRows.push({
        ...row,
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

export function preprocessDetail(rows, numericalColumns) {
  return rows.map((row) => {
    const parsed = { ...row }

    numericalColumns.forEach((column) => {
      if (parsed[column] !== undefined) {
        parsed[column] = toNullableNumber(parsed[column])
      }
    })

    const minute = toNullableNumber(parsed['exp.minute'])
    parsed['exp.minute'] = minute
    parsed.hour = minute === null ? null : minute / 60
    parsed['exp.hour'] = parsed.hour
    return parsed
  })
}

export function attachSessionMetadata(detailRows, session) {
  if (!Array.isArray(detailRows) || !detailRows.length) {
    return []
  }

  return detailRows.map((row) => {
    const groupIndex = resolveSubjectGroupIndex(row['subject.id'] || row.subject_id, session)

    return {
      ...row,
      groupName: session.groupNames[groupIndex] || 'Unknown',
      groupIndex,
      diet: session.dietNames[groupIndex] || null,
      color: session.colors[groupIndex] || '#888',
      dietCal: session.dietCal[groupIndex] || null,
    }
  })
}

export function enrichDetailRows(detailRows, session) {
  const sessionSubjects = new Map((session.subjects || []).map((subject) => [subject.subject, subject]))

  return attachSessionMetadata(detailRows, session).map((row) => {
    const subjectId = normalizeSubjectIdentifier(row['subject.id'] || row.subject_id)
    const subjectSession = sessionSubjects.get(subjectId) || {}
    const expMinute = toNullableNumber(row['exp.minute'])
    const enviroLight = toNullableNumber(row['enviro.light'])
    const clockHour = computeClockHour(expMinute)
    const lightFlag = enviroLight === null
      ? (clockHour !== null && clockHour >= session.light_cycle_start && clockHour < session.dark_cycle_start ? 1 : 0)
      : (enviroLight > 1 ? 1 : 0)

    const enrichedRow = convertFeedColumns(applySessionFieldFallbacks({
      ...row,
      'exp.minute': expMinute,
      hour: expMinute === null ? null : expMinute / 60,
      'exp.hour': expMinute === null ? null : expMinute / 60,
      'enviro.light': enviroLight,
      light: lightFlag,
      dark: lightFlag === null ? null : lightFlag === 1 ? 0 : 1,
      day: computeCycleDay(expMinute, session.light_cycle_start),
      'exp.day': computeCycleDay(expMinute, session.light_cycle_start),
      clockHour,
      subjectSession,
    }, subjectSession))

    const feedValue = toNullableNumber(enrichedRow.feed)
    const eeValue = toNullableNumber(enrichedRow.ee)
    const feedAccValue = toNullableNumber(enrichedRow['feed.acc'])
    const eeAccValue = toNullableNumber(enrichedRow['ee.acc'])

    return {
      ...enrichedRow,
      eb: feedValue === null || eeValue === null ? null : feedValue - eeValue,
      'eb.acc': feedAccValue === null || eeAccValue === null ? null : feedAccValue - eeAccValue,
    }
  })
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

function toProcessingSessionShape(session, fallbackCycleStarts, sessionRows = []) {
  if (!session) {
    return {
      ...preprocessSession(sessionRows),
      light_cycle_start: fallbackCycleStarts.lightCycleStart,
      dark_cycle_start: fallbackCycleStarts.darkCycleStart,
      subjects: [],
    }
  }

  const hasLegacyGroups = Array.isArray(session.groups) && session.groups.every((group) => Array.isArray(group))

  if (hasLegacyGroups) {
    return {
      ...session,
      light_cycle_start: session.light_cycle_start ?? fallbackCycleStarts.lightCycleStart,
      dark_cycle_start: session.dark_cycle_start ?? fallbackCycleStarts.darkCycleStart,
      subjects: session.subjects || [],
    }
  }

  const normalizedGroups = Array.isArray(session.groups) ? session.groups : []
  const normalizedSubjects = Array.isArray(session.subjects) ? session.subjects : []
  const groups = normalizedGroups.map((_, groupIndex) =>
    normalizedSubjects
      .filter((subject) => Number(subject.groupIndex) === groupIndex)
      .map((subject) => `${subject.subject}`),
  )

  return {
    ...session,
    groupNames: normalizedGroups.map((group) => group.name || ''),
    dietNames: normalizedGroups.map((group) => group.diet_name || ''),
    colors: normalizedGroups.map((group, index) => group.color || DEFAULT_GROUP_COLORS[index % DEFAULT_GROUP_COLORS.length]),
    dietCal: normalizedGroups.map((group) => toNullableNumber(group.diet_kcal)),
    groups,
    subjects: normalizedSubjects,
    light_cycle_start: session.light_cycle_start ?? fallbackCycleStarts.lightCycleStart,
    dark_cycle_start: session.dark_cycle_start ?? fallbackCycleStarts.darkCycleStart,
  }
}

export function processDetail(rows, {
  numericalColumns = [],
  sessionRows = [],
  session = null,
  applySessionExclusions = true,
  hourRange = null,
} = {}) {
  const normalizedSession = session || preprocessSession(sessionRows)
  const cycleStarts = {
    lightCycleStart: normalizedSession.light_cycle_start ?? getSessionCycleStartsFromRows(sessionRows).lightCycleStart,
    darkCycleStart: normalizedSession.dark_cycle_start ?? getSessionCycleStartsFromRows(sessionRows).darkCycleStart,
  }

  let processedRows = ensureExpMinute(rows)

  if (processedRows.length && processedRows.every((row) => isBlank(row['enviro.light']))) {
    processedRows = ensureEnviroLight(processedRows, cycleStarts.lightCycleStart, cycleStarts.darkCycleStart)
  }

  const sessionPayload = toProcessingSessionShape(normalizedSession, cycleStarts, sessionRows)

  processedRows = preprocessDetail(processedRows, numericalColumns)
  processedRows = enrichDetailRows(processedRows, sessionPayload)
  processedRows = fillAccumulatorColumns(processedRows)

  if (applySessionExclusions) {
    processedRows = applyExclusions(processedRows, sessionPayload)
  }

  if (hourRange) {
    processedRows = cropDetailRows(processedRows, hourRange)
  }

  return processedRows
}

export function aggregateDetailRows(detailRows, {
  per = 'min',
  grp = true,
  variables = null,
} = {}) {
  if (!Array.isArray(detailRows) || !detailRows.length) {
    return []
  }

  const minuteBin = computeMinuteBin(detailRows)
  const aggregateVariables = variables || Object.keys(detailRows[0]).filter((key) => {
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

    if (per === 'min') {
      if (aggregated.feed !== null) {
        aggregated.feed *= minuteBin
      }

      if (aggregated['ee.acc'] !== null) {
        aggregated['ee.acc'] /= minuteBin
      }
    }

    if (aggregated.feed !== null && aggregated.ee !== null) {
      aggregated.eb = aggregated.feed - aggregated.ee
    }

    if (aggregated['feed.acc'] !== null && aggregated['ee.acc'] !== null) {
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
}

export function buildTimeSeriesDataset(detailRows) {
  const groupedRows = aggregateDetailRows(detailRows, { per: 'min', grp: true })
  const subjectRows = aggregateDetailRows(detailRows, { per: 'min', grp: false })

  return {
    groupedRows,
    subjectRows,
  }
}

export function buildBoxPlotDataset(detailRows, variable, options = {}) {
  if (!Array.isArray(detailRows) || !detailRows.length) {
    return []
  }

  const removeOutliers = options.removeOutliers ?? true
  const outlierHandledRows = removeOutliers ? applyDefaultOutlierRemoval(detailRows) : detailRows
  const hourlyVariables = variable === 'eb' ? ['feed', 'ee'] : [variable]

  const hourlyRows = aggregateDetailRows(outlierHandledRows, {
    per: 'hour',
    grp: false,
    variables: hourlyVariables,
  })

  const subjectPeriods = new Map()

  hourlyRows.forEach((row) => {
    const subjectId = row['subject.id']
    const baseKey = `${subjectId}::${row.groupName || 'Unknown'}`
    const periodBuckets = [
      { period: 'Total', include: true },
      { period: 'Dark', include: Number(row.light) === 0 },
      { period: 'Light', include: Number(row.light) === 1 },
    ]

    periodBuckets.forEach(({ period, include }) => {
      if (!include) {
        return
      }

      const key = `${baseKey}::${period}`
      const value = variable === 'eb'
        ? (row.feed === null || row.ee === null ? null : row.feed - row.ee)
        : row[variable]

      if (value === null || Number.isNaN(value)) {
        return
      }

      if (!subjectPeriods.has(key)) {
        subjectPeriods.set(key, {
          period,
          groupName: row.groupName || 'Unknown',
          color: row.color || '#888',
          subjectId,
          values: [],
        })
      }

      subjectPeriods.get(key).values.push(value)
    })
  })

  const periodOrder = ['Total', 'Dark', 'Light']
  const subjectEntries = [...subjectPeriods.values()]
    .map((entry) => ({
      period: entry.period,
      groupName: entry.groupName,
      color: entry.color,
      'subject.id': entry.subjectId,
      value: mean(entry.values),
    }))
    .filter((entry) => entry.value !== null && !Number.isNaN(entry.value))

  const buckets = new Map()

  subjectEntries.forEach((entry) => {
    const key = `${entry.groupName}::${entry.period}`
    if (!buckets.has(key)) {
      buckets.set(key, [])
    }
    buckets.get(key).push(entry.value)
  })

  const sortedEntries = subjectEntries.sort((left, right) => {
      const periodDiff = periodOrder.indexOf(left.period) - periodOrder.indexOf(right.period)
      if (periodDiff) {
        return periodDiff
      }

      const groupDiff = String(left.groupName).localeCompare(String(right.groupName))
      if (groupDiff) {
        return groupDiff
      }

      return String(left['subject.id']).localeCompare(String(right['subject.id']))
    })

  if (!removeOutliers) {
    return sortedEntries
  }

  const thresholds = new Map()

  buckets.forEach((values, key) => {
    if (values.length < 5) {
      thresholds.set(key, null)
      return
    }

    const sorted = [...values].sort((left, right) => left - right)
    const q1 = quantile(sorted, 0.25)
    const q3 = quantile(sorted, 0.75)

    if (q1 === null || q3 === null) {
      thresholds.set(key, null)
      return
    }

    const iqr = q3 - q1

    thresholds.set(key, {
      lower: q1 - (1.5 * iqr),
      upper: q3 + (1.5 * iqr),
    })
  })

  return sortedEntries.filter((entry) => {
    const threshold = thresholds.get(`${entry.groupName}::${entry.period}`)

    if (!threshold) {
      return true
    }

    return entry.value >= threshold.lower && entry.value <= threshold.upper
  })
}

export function buildRegressionDataset(detailRows, {
  xVar,
  yVar,
  period = 'Total',
  removeOutliers = true,
  hourRange = null,
} = {}) {
  if (!Array.isArray(detailRows) || !detailRows.length || !xVar || !yVar) {
    return []
  }

  let sourceRows = detailRows

  if (Array.isArray(hourRange) && hourRange.length === 2) {
    sourceRows = cropDetailRows(sourceRows, hourRange)
  }

  const subjectMetadata = new Map()

  sourceRows.forEach((row) => {
    const subjectId = row['subject.id']

    if (!subjectId || subjectMetadata.has(subjectId)) {
      return
    }

    subjectMetadata.set(subjectId, {
      subjectSession: row.subjectSession || {},
      row,
    })
  })

  const outlierHandledRows = removeOutliers ? applyDefaultOutlierRemoval(sourceRows) : sourceRows
  const aggregateVariables = [...new Set([xVar, yVar])]
  const per = period === 'Total' ? 'hour' : 'light'

  let aggregatedRows = aggregateDetailRows(outlierHandledRows, {
    per,
    grp: false,
    variables: aggregateVariables,
  })

  if (period === 'Light') {
    aggregatedRows = aggregatedRows.filter((row) => Number(row.light) === 1)
  } else if (period === 'Dark') {
    aggregatedRows = aggregatedRows.filter((row) => Number(row.light) === 0)
  }

  const subjectRows = new Map()

  const getRegressionCovariateValue = (row) => {
    const metadata = subjectMetadata.get(row['subject.id'])
    const subjectSession = metadata?.subjectSession || {}
    const sourceRow = metadata?.row || row

    if (xVar === 'subject.mass') {
      return toNullableNumber(subjectSession.total_mass ?? sourceRow['subject.mass'])
    }

    if (xVar === 'subject.lean.mass') {
      return toNullableNumber(subjectSession.lean_mass ?? sourceRow['subject.lean.mass'])
    }

    if (xVar === 'subject.fat.mass') {
      return toNullableNumber(subjectSession.fat_mass ?? sourceRow['subject.fat.mass'])
    }

    return toNullableNumber(row[xVar])
  }

  aggregatedRows.forEach((row) => {
    const subjectId = row['subject.id']
    const xValue = getRegressionCovariateValue(row)
    const yValue = toNullableNumber(row[yVar])

    if (!subjectId || xValue === null || yValue === null) {
      return
    }

    if (!subjectRows.has(subjectId)) {
      subjectRows.set(subjectId, {
        'subject.id': subjectId,
        groupName: row.groupName || 'Unknown',
        color: row.color || '#888',
        xValues: [],
        yValues: [],
      })
    }

    const subjectEntry = subjectRows.get(subjectId)
    subjectEntry.xValues.push(xValue)
    subjectEntry.yValues.push(yValue)
  })

  return [...subjectRows.values()]
    .map((row) => ({
      'subject.id': row['subject.id'],
      groupName: row.groupName,
      color: row.color,
      x: mean(row.xValues),
      y: mean(row.yValues),
    }))
    .filter((row) => row.x !== null && row.y !== null && !Number.isNaN(row.x) && !Number.isNaN(row.y))
    .sort((left, right) => {
      const groupDiff = String(left.groupName).localeCompare(String(right.groupName))
      if (groupDiff) {
        return groupDiff
      }

      return String(left['subject.id']).localeCompare(String(right['subject.id']))
    })
}

export function buildWeightDataset(detailRows, {
  mode = 'total',
} = {}) {
  if (!Array.isArray(detailRows) || !detailRows.length) {
    return []
  }

  const subjects = new Map()

  detailRows.forEach((row) => {
    const subjectId = row['subject.id']

    if (!subjectId) {
      return
    }

    if (!subjects.has(subjectId)) {
      subjects.set(subjectId, {
        'subject.id': subjectId,
        groupName: row.groupName || 'Unknown',
        color: row.color || '#888',
        totalValues: [],
        leanValues: [],
        fatValues: [],
        subjectSession: row.subjectSession || {},
      })
    }

    const subject = subjects.get(subjectId)
    const totalValue = toNullableNumber(row['subject.mass'])
    const leanValue = toNullableNumber(row['subject.lean.mass'])
    const fatValue = toNullableNumber(row['subject.fat.mass'])

    if (totalValue !== null) {
      subject.totalValues.push(totalValue)
    }
    if (leanValue !== null) {
      subject.leanValues.push(leanValue)
    }
    if (fatValue !== null) {
      subject.fatValues.push(fatValue)
    }
  })

  const subjectEntries = [...subjects.values()].map((subject) => {
    const totalMass = toNullableNumber(subject.subjectSession.total_mass) ?? mean(subject.totalValues)
    const leanMass = toNullableNumber(subject.subjectSession.lean_mass) ?? mean(subject.leanValues)
    const fatMass = toNullableNumber(subject.subjectSession.fat_mass) ?? mean(subject.fatValues)

    return {
      'subject.id': subject['subject.id'],
      groupName: subject.groupName,
      color: subject.color,
      totalMass,
      leanMass,
      fatMass,
    }
  })

  const metricsByMode = {
    total: [{ key: 'totalMass', label: 'Total' }],
    composition: [
      { key: 'fatMass', label: 'Fat' },
      { key: 'leanMass', label: 'Lean' },
      { key: 'totalMass', label: 'Total' },
    ],
    compositionPercent: [
      { key: 'fatPercent', label: 'Fat' },
      { key: 'leanPercent', label: 'Lean' },
    ],
  }

  const entriesWithPercents = subjectEntries.map((entry) => ({
    ...entry,
    fatPercent: entry.totalMass && entry.fatMass !== null ? (entry.fatMass / entry.totalMass) * 100 : null,
    leanPercent: entry.totalMass && entry.leanMass !== null ? (entry.leanMass / entry.totalMass) * 100 : null,
  }))

  const metrics = metricsByMode[mode] || metricsByMode.total
  const grouped = new Map()

  entriesWithPercents.forEach((entry) => {
    if (!grouped.has(entry.groupName)) {
      grouped.set(entry.groupName, {
        color: entry.color,
        metrics: new Map(),
      })
    }

    const group = grouped.get(entry.groupName)

    metrics.forEach(({ key, label }) => {
      const value = toNullableNumber(entry[key])

      if (value === null) {
        return
      }

      if (!group.metrics.has(label)) {
        group.metrics.set(label, [])
      }

      group.metrics.get(label).push(value)
    })
  })

  return [...grouped.entries()].flatMap(([groupName, group]) =>
    metrics
      .map(({ label }) => {
        const values = group.metrics.get(label) || []

        if (!values.length) {
          return null
        }

        return {
          groupName,
          color: group.color,
          metric: label,
          mean: mean(values),
          sem: sampleSem(values),
          n: values.length,
        }
      })
      .filter(Boolean),
  )
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
    color: payload.group_colors?.[group?.name] || DEFAULT_GROUP_COLORS[index % DEFAULT_GROUP_COLORS.length],
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
      exc_hour: exclusionNumber ?? baseSubject.exc_hour,
      exc_reason: exclusionNumber === null && !isBlank(exclusionValue)
        ? `${exclusionValue}`.trim()
        : (!baseSubject.exc_reason && (exclusionNumber ?? baseSubject.exc_hour) !== null && stackedReason)
            ? stackedReason
        : baseSubject.exc_reason,
    }
  })

  const cycleStarts = getSessionCycleStartsFromRows(rows)

  return normalizeSessionPayload({
    ...basePayload,
    groups,
    subjects,
    light_cycle_start: cycleStarts.lightCycleStart ?? basePayload.light_cycle_start,
    dark_cycle_start: cycleStarts.darkCycleStart ?? basePayload.dark_cycle_start,
    hour_range: xRanges.length >= 2
      ? [xRanges[0], xRanges[1]]
      : basePayload.hour_range,
    remove_outliers: outlierValues.length
      ? outlierValues[0] === 'yes' || outlierValues[0] === 'true'
      : basePayload.remove_outliers,
  })
}
