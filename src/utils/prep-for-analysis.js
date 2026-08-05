// Analysis-prep entry points.
// This file turns backend-enriched analysis payloads plus session metadata into
// the shared analysis dataset shape consumed by the plotting modules.
import { parseCsv } from './csv'
import { applyExclusions, ensureExpMinute, normalizeSessionPayload } from './process'

function toAnalysisSession(sessionPayload = {}) {
  const groups = Array.isArray(sessionPayload.groups) ? sessionPayload.groups : []

  return {
    ...sessionPayload,
    groupNames: groups.map((group) => group.name || ''),
    dietNames: groups.map((group) => group.diet_name || ''),
    dietCal: groups.map((group) => group.diet_kcal ?? null),
    colors: groups.map((group) => group.color || '#888'),
  }
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

function computeClockHour(expMinute) {
  if (expMinute === null) {
    return null
  }

  return ((expMinute / 60) % 24 + 24) % 24
}

function computeCycleDay(expMinute, lightCycleStart) {
  if (expMinute === null || lightCycleStart === null || lightCycleStart === undefined) {
    return null
  }

  return Math.floor((expMinute / 60 - lightCycleStart) / 24)
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

function computeMinuteBin(rows) {
  const minutes = rows
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

  return modeDiffMinutes ? 60 / modeDiffMinutes : 1
}

function rowSortValue(row) {
  const expMinute = toNullableNumber(row?.['exp.minute'])
  if (expMinute !== null) {
    return expMinute
  }

  const parsedTime = Date.parse(row?.['Date.Time'] || row?.['Time.Date'] || '')
  return Number.isNaN(parsedTime) ? Number.POSITIVE_INFINITY : parsedTime
}

function computeAccumulatorBaselines(rows) {
  const baselines = new Map()

  rows
    .slice()
    .sort((left, right) => rowSortValue(left) - rowSortValue(right))
    .forEach((row) => {
      const subjectId = isBlank(row?.['subject.id'])
        ? (isBlank(row?.subject_id) ? null : `${row.subject_id}`.trim())
        : `${row['subject.id']}`.trim()

      if (!subjectId || baselines.has(subjectId)) {
        return
      }

      baselines.set(subjectId, {
        feedAcc: toNullableNumber(row?.['feed.acc']) ?? 0,
        eeAcc: toNullableNumber(row?.['ee.acc']) ?? 0,
        ebAcc: toNullableNumber(row?.['eb.acc']) ?? 0,
      })
    })

  return baselines
}

function normalizeEnrichedRows(payload) {
  if (typeof payload === 'string') {
    return parseCsv(payload)
  }

  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  if (Array.isArray(payload?.detail_rows)) {
    return payload.detail_rows
  }

  if (Array.isArray(payload?.detailRows)) {
    return payload.detailRows
  }

  return []
}

function normalizeEnrichedSession(payload, fallbackSession) {
  const payloadSession = payload?.session || payload?.session_config || payload?.metadata

  if (!payloadSession || typeof payloadSession !== 'object') {
    return fallbackSession
  }

  const session = {
    ...fallbackSession,
    ...payloadSession,
  }

  if (Array.isArray(payloadSession.groups) && payloadSession.groups.every((group) => group && typeof group === 'object' && !Array.isArray(group))) {
    return {
      ...session,
      ...toAnalysisSession(payloadSession),
    }
  }

  return {
    ...session,
    groupNames: payloadSession.groupNames ?? session.groupNames ?? fallbackSession.groupNames ?? [],
    dietNames: payloadSession.dietNames ?? session.dietNames ?? fallbackSession.dietNames ?? [],
    dietCal: payloadSession.dietCal ?? session.dietCal ?? fallbackSession.dietCal ?? [],
    colors: payloadSession.colors ?? session.colors ?? fallbackSession.colors ?? [],
  }
}

function normalizeEnrichedDetailRows(payload, fallbackSession, numericalColumns) {
  const sourceRows = normalizeEnrichedRows(payload)
  const rowsWithExpMinute = ensureExpMinute(sourceRows.map((row) => {
    if (!isBlank(row?.['exp.minute'])) {
      return row
    }

    const nextRow = { ...row }
    delete nextRow['exp.minute']
    return nextRow
  }))
  const minuteBin = computeMinuteBin(rowsWithExpMinute)
  const hasExplicitEbAcc = rowsWithExpMinute.some((row) => !isBlank(row?.['eb.acc']))
  const accumulatorBaselines = computeAccumulatorBaselines(rowsWithExpMinute)

  const subjectSessions = new Map(
    (fallbackSession.subjects || []).map((subject) => [`${subject.subject}`, subject]),
  )

  return rowsWithExpMinute.map((row) => {
    const parsedRow = { ...row }

    numericalColumns.forEach((column) => {
      if (parsedRow[column] !== undefined) {
        parsedRow[column] = toNullableNumber(parsedRow[column])
      }
    })

    const subjectId = isBlank(parsedRow['subject.id'])
      ? (isBlank(parsedRow.subject_id) ? null : `${parsedRow.subject_id}`.trim())
      : `${parsedRow['subject.id']}`.trim()
    const subjectSession = subjectId ? (subjectSessions.get(subjectId) || {}) : {}
    const groupIndex = toNullableNumber(parsedRow.groupIndex) ?? subjectSession.groupIndex ?? 0
    const expMinute = toNullableNumber(parsedRow['exp.minute'])
    const expHour = toNullableNumber(parsedRow['exp.hour']) ?? toNullableNumber(parsedRow.hour) ?? (expMinute === null ? null : expMinute / 60)
    const enviroLight = toNullableNumber(parsedRow['enviro.light'])
    const inferredLight = enviroLight === null ? null : (enviroLight > 1 ? 1 : 0)
    const light = toNullableNumber(parsedRow.light) ?? inferredLight
    const dark = toNullableNumber(parsedRow.dark) ?? (light === null ? null : (light === 1 ? 0 : 1))
    const day = toNullableNumber(parsedRow.day)
      ?? toNullableNumber(parsedRow['exp.day'])
      ?? computeCycleDay(expMinute, fallbackSession.light_cycle_start)
    const dietCal = toNullableNumber(parsedRow.dietCal) ?? fallbackSession.dietCal[groupIndex] ?? null
    const shouldApplyDietCalories = !hasExplicitEbAcc && dietCal !== null
    const feed = toNullableNumber(parsedRow.feed)
    const ee = toNullableNumber(parsedRow.ee)
    const feedAcc = toNullableNumber(parsedRow['feed.acc'])
    const eeAcc = toNullableNumber(parsedRow['ee.acc'])
    const explicitEbAcc = toNullableNumber(parsedRow['eb.acc'])
    const baseline = accumulatorBaselines.get(subjectId) || { feedAcc: 0, eeAcc: 0, ebAcc: 0 }
    const feedAccZeroed = feedAcc === null ? null : feedAcc - baseline.feedAcc
    const eeAccZeroed = eeAcc === null ? null : eeAcc - baseline.eeAcc
    const ebAccZeroed = explicitEbAcc === null ? null : explicitEbAcc - baseline.ebAcc
    const feedKcal = shouldApplyDietCalories && feed !== null ? feed * dietCal : feed
    const feedAccKcal = shouldApplyDietCalories && feedAccZeroed !== null ? feedAccZeroed * dietCal : feedAccZeroed
    const eeAccKcal = eeAccZeroed === null ? null : eeAccZeroed / minuteBin
    const eb = feedKcal === null || ee === null ? null : (feedKcal * minuteBin) - ee
    const ebAcc = hasExplicitEbAcc
      ? ebAccZeroed
      : (feedAccKcal === null || eeAccKcal === null ? null : feedAccKcal - eeAccKcal)

    return {
      ...parsedRow,
      'subject.id': subjectId ?? parsedRow['subject.id'],
      'exp.minute': expMinute,
      hour: expHour,
      'exp.hour': expHour,
      day,
      'exp.day': day,
      clockHour: toNullableNumber(parsedRow.clockHour) ?? computeClockHour(expMinute),
      'enviro.light': enviroLight,
      light,
      dark,
      groupIndex,
      groupName: parsedRow.groupName || parsedRow.group || fallbackSession.groupNames[groupIndex] || 'Unknown',
      color: parsedRow.color || fallbackSession.colors[groupIndex] || '#888',
      diet: parsedRow.diet || fallbackSession.dietNames[groupIndex] || null,
      dietCal,
      subjectSession,
      'subject.mass': toNullableNumber(parsedRow['subject.mass']) ?? subjectSession.total_mass ?? null,
      'subject.lean.mass': toNullableNumber(parsedRow['subject.lean.mass']) ?? subjectSession.lean_mass ?? null,
      'subject.fat.mass': toNullableNumber(parsedRow['subject.fat.mass']) ?? subjectSession.fat_mass ?? null,
      feed: feedKcal,
      'feed.acc': feedAccKcal,
      'ee.acc': eeAccKcal,
      eb,
      'eb.acc': ebAcc,
    }
  })
}

export function normalizeEnrichedAnalysisData(payload, {
  numericalColumns = [],
  sessionConfig = {},
  applySessionExclusions = true,
} = {}) {
  const fallbackSession = toAnalysisSession(normalizeSessionPayload(sessionConfig))
  const rows = normalizeEnrichedDetailRows(payload, fallbackSession, numericalColumns)

  return {
    rows: applySessionExclusions ? applyExclusions(rows, fallbackSession) : rows,
    session: normalizeEnrichedSession(payload, fallbackSession),
  }
}
