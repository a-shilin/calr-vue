// Analysis-prep entry points.
// This file turns loaded converted CALR rows plus session metadata into the
// shared analysis dataset shape consumed by the plotting modules.
import { mergeSessionCsvIntoPayload, processDetail } from './process'

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

export function buildAnalysisSession(sessionRows = [], fallbackPayload = {}) {
  return toAnalysisSession(mergeSessionCsvIntoPayload(sessionRows, fallbackPayload))
}

export function prepForAnalysis(detailRows, {
  numericalColumns = [],
  sessionRows = [],
  sessionConfig = {},
  applySessionExclusions = true,
  hourRange = null,
} = {}) {
  const session = buildAnalysisSession(sessionRows, sessionConfig)
  const rows = processDetail(detailRows, {
    numericalColumns,
    sessionRows,
    session,
    applySessionExclusions,
    hourRange,
  })

  return {
    rows,
    session,
  }
}
