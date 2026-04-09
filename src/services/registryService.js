const API_BASE = 'https://api.kpndataregistry.org:8000/api/calr'
const AUTH_BASE = 'https://users.kpndataregistry.org/api/auth'

function createHeaders(token, extraHeaders = {}) {
  return token
    ? {
        Authorization: `Bearer ${token}`,
        ...extraHeaders,
      }
    : extraHeaders
}

async function parseJsonResponse(response) {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  return response.json()
}

function normalizeListPayload(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.results)) {
    return payload.results
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  return []
}

async function parseTextResponse(response) {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  return response.text()
}

export async function login(username, password) {
  const response = await fetch(`${AUTH_BASE}/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      group: 'calr',
    }),
  })

  return parseJsonResponse(response)
}

export async function fetchUserFiles(token) {
  const response = await fetch(`${API_BASE}/files`, {
    headers: createHeaders(token, {
      'Content-Type': 'application/json',
    }),
  })

  return normalizeListPayload(await parseJsonResponse(response))
}

export async function fetchPublicFiles() {
  const response = await fetch(`${API_BASE}/public`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  return normalizeListPayload(await parseJsonResponse(response))
}

export async function fetchDataFile(fileId, token, isPublic = false) {
  const response = await fetch(`${API_BASE}/files/${fileId}`, {
    headers: isPublic ? {} : createHeaders(token),
  })

  return parseTextResponse(response)
}

export async function fetchSessionFile(fileId, token, isPublic = false) {
  const response = await fetch(`${API_BASE}/sessions/${fileId}/csv`, {
    headers: isPublic ? {} : createHeaders(token),
  })

  return parseTextResponse(response)
}

export async function fetchSessionConfig(fileId, token, isPublic = false) {
  const response = await fetch(`${API_BASE}/sessions/${fileId}`, {
    headers: isPublic ? {} : createHeaders(token),
  })

  return parseJsonResponse(response)
}

export async function fetchEnrichedData(sessionId, token) {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/enriched`, {
    headers: token ? createHeaders(token) : {},
  })

  return parseTextResponse(response)
}

export async function updateExperimentPublicStatus(fileId, makePublic, token) {
  const response = await fetch(`${API_BASE}/files/${fileId}?public=${makePublic}`, {
    method: 'PATCH',
    headers: createHeaders(token),
  })

  return parseJsonResponse(response)
}

export async function deleteExperiment(fileId, token) {
  const response = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: createHeaders(token, {
      'Content-Type': 'application/json',
    }),
  })

  return parseJsonResponse(response)
}

export async function convertInstrumentFiles(files) {
  const form = new FormData()

  files.forEach((file) => {
    form.append('files', file)
  })

  const response = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    body: form,
  })

  return parseTextResponse(response)
}

export async function uploadCalrFile(convertedCSV, experimentName, description, token, isPublic = false) {
  const file = new File([convertedCSV], 'calr_converted.csv', {
    type: 'text/csv',
  })
  const form = new FormData()

  form.append('standard_file', file)
  form.append('name', experimentName)
  form.append('description', description)
  form.append('public', `${isPublic}`)

  const response = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: createHeaders(token),
    body: form,
  })

  return parseJsonResponse(response)
}

export async function uploadSessionFile(submissionId, sessionPayload, token) {
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: createHeaders(token, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      submission_id: submissionId,
      ...sessionPayload,
    }),
  })

  return parseJsonResponse(response)
}

export async function updateSessionFile(sessionId, submissionId, sessionPayload, token) {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'PUT',
    headers: createHeaders(token, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      submission_id: submissionId,
      ...sessionPayload,
    }),
  })

  return parseJsonResponse(response)
}

export async function updateExperimentMetadata(submissionId, metadataPayload, token) {
  const response = await fetch(`${API_BASE}/submissions/${submissionId}/metadata`, {
    method: 'PATCH',
    headers: createHeaders(token, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(metadataPayload),
  })

  return parseJsonResponse(response)
}

export async function runAnalysis(endpoint, payload, token, isPublic = false) {
  const response = await fetch(`${API_BASE}/analysis/${endpoint}`, {
    method: 'POST',
    headers: isPublic
      ? { 'Content-Type': 'application/json' }
      : createHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  return parseJsonResponse(response)
}
