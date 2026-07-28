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

export function formatGroupCount(value) {
  return Number.isInteger(value) && value >= 0 ? `${value}` : '—'
}
