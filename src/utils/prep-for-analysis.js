// Analysis-prep entry points.
// This file turns loaded converted CALR rows plus session metadata into the
// shared analysis dataset shape consumed by the plotting modules.
import { mergeSessionCsvIntoPayload } from './process'

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
