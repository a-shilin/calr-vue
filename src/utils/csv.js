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
