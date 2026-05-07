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
    const feed = toNullableNumber(parsedRow.feed)
    const ee = toNullableNumber(parsedRow.ee)
    const feedAcc = toNullableNumber(parsedRow['feed.acc'])
    const eeAcc = toNullableNumber(parsedRow['ee.acc'])

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
      dietCal: toNullableNumber(parsedRow.dietCal) ?? fallbackSession.dietCal[groupIndex] ?? null,
      subjectSession,
      'subject.mass': toNullableNumber(parsedRow['subject.mass']) ?? subjectSession.total_mass ?? null,
      'subject.lean.mass': toNullableNumber(parsedRow['subject.lean.mass']) ?? subjectSession.lean_mass ?? null,
      'subject.fat.mass': toNullableNumber(parsedRow['subject.fat.mass']) ?? subjectSession.fat_mass ?? null,
      eb: toNullableNumber(parsedRow.eb) ?? (feed === null || ee === null ? null : feed - ee),
      'eb.acc': toNullableNumber(parsedRow['eb.acc']) ?? (feedAcc === null || eeAcc === null ? null : feedAcc - eeAcc),
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
