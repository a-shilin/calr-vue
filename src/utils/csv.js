import Papa from 'papaparse'

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
  const isBlank = (value) => value === null || value === undefined || `${value}`.trim() === '' || `${value}`.trim().toUpperCase() === 'NA'
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
