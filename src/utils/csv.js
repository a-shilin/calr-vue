import Papa from 'papaparse'

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

export function parseCsv(text, options = {}) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    ...options,
  })

  return result.data
}

export function ensureExpMinute(rows) {
  if (!Array.isArray(rows) || !rows.length || rows[0]['exp.minute'] !== undefined) {
    return rows
  }

  const timeKey = rows[0]['Date.Time'] !== undefined ? 'Date.Time' : rows[0]['Time.Date'] !== undefined ? 'Time.Date' : null

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

  const timeKey = rows[0]['Date.Time'] !== undefined ? 'Date.Time' : rows[0]['Time.Date'] !== undefined ? 'Time.Date' : null

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

export function preprocessDetail(rows, numericalColumns) {
  return rows.map((row) => {
    const parsed = { ...row }

    numericalColumns.forEach((column) => {
      if (parsed[column] !== undefined) {
        const value = Number(parsed[column])
        parsed[column] = Number.isNaN(value) ? null : value
      }
    })

    const minute = Number(parsed['exp.minute'])
    parsed.hour = Number.isNaN(minute) ? null : minute / 60
    return parsed
  })
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

export function normalizeSessionPayload(payload = {}) {
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
          toNullableNumber(payload.hour_range[0]) ?? 0,
          toNullableNumber(payload.hour_range[1]) ?? 24,
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
    groups: [
      { name: 'WT', diet_name: 'LabDiet 5008', diet_kcal: 3.56 },
      { name: 'KO', diet_name: 'Research Diet 60 kcal% Fat', diet_kcal: 5.21 },
    ],
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
  })
}

export function preprocessSummary(rows) {
  return rows.map((row) => {
    const parsed = { ...row }

    Object.keys(parsed).forEach((key) => {
      const numericValue = Number(parsed[key])
      if (!Number.isNaN(numericValue) && parsed[key] !== '') {
        parsed[key] = numericValue
      }
    })

    return parsed
  })
}

export function attachSessionMetadata(detailRows, session) {
  if (!Array.isArray(detailRows) || !detailRows.length) {
    return []
  }

  const firstGroupValue = session.groups?.[0]?.[0]
  const useCompoundSubjectId = typeof firstGroupValue === 'string' && firstGroupValue.includes('_')

  return detailRows.map((row) => {
    const subjectIdValue = String(row['subject.id'] || row.subject_id || '')
    const subjectId = useCompoundSubjectId ? subjectIdValue : subjectIdValue.split('_')[0]
    const groupIndex = session.groups.findIndex((group) => group.includes(subjectId))

    return {
      ...row,
      groupName: session.groupNames[groupIndex] || 'Unknown',
      diet: session.dietNames[groupIndex] || null,
      color: session.colors[groupIndex] || '#888',
      dietCal: session.dietCal[groupIndex] || null,
    }
  })
}
