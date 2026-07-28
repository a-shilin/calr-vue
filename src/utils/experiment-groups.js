export const COMMUNITY_SUMMARY_CSV_URL = `${import.meta.env.BASE_URL}02032026_combined_datasets_calrepo.csv`

function toFiniteCount(value) {
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 ? count : null
}

export function countConfiguredGroups(sessionPayload = {}) {
  if (Array.isArray(sessionPayload.groups)) {
    return sessionPayload.groups.length
  }

  if (Array.isArray(sessionPayload.groupNames)) {
    return sessionPayload.groupNames.filter((value) => `${value || ''}`.trim()).length
  }

  if (typeof sessionPayload.group_names === 'string') {
    return sessionPayload.group_names
      .split(/[|,;]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .length
  }

  return null
}

export function resolveExperimentGroupCount(source = {}) {
  const directCount = toFiniteCount(
    source.groupCount ?? source.group_count ?? source.groups_count ?? source.n_groups,
  )

  if (directCount !== null) {
    return directCount
  }

  return countConfiguredGroups(source.session || source.session_config || source)
}

export function countDistinctGroups(rows = [], experimentId, experimentKey = 'experiment_id', groupKey = 'group') {
  const groups = new Set()

  rows.forEach((row) => {
    if (`${row?.[experimentKey] || ''}` !== `${experimentId || ''}`) {
      return
    }

    const group = `${row?.[groupKey] || ''}`.trim()
    if (group) {
      groups.add(group)
    }
  })

  return groups.size
}

export function buildCommunityGroupCountMap(summaryRows = []) {
  const counts = new Map()

  summaryRows.forEach((row) => {
    const experimentId = `${row?.experiment_id || ''}`.trim()
    const group = `${row?.group || row?.Group || ''}`.trim()

    if (!experimentId || !group) {
      return
    }

    if (!counts.has(experimentId)) {
      counts.set(experimentId, new Set())
    }

    counts.get(experimentId).add(group)
  })

  return new Map([...counts.entries()].map(([experimentId, groups]) => [experimentId, groups.size]))
}

export function formatGroupCount(value) {
  return Number.isInteger(value) && value >= 0 ? `${value}` : '—'
}
