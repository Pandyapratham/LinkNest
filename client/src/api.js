// Empty string = use relative URLs, which go through the Vite dev proxy.
// Set VITE_API_BASE_URL in client/.env for production pointing at a real backend.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export async function apiRequest(path, { method = 'GET', body, signal, responseType = 'json' } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Could not reach Pinpoint. Check that the backend is running and try again.')
  }

  const contentType = response.headers.get('content-type') || ''
  let payload = null
  if (contentType.includes('application/json')) {
    try { payload = await response.json() } catch { payload = null }
  }
  if (!response.ok || payload?.success === false) {
    const fallback = response.status === 401 ? 'Please sign in to continue.' : 'That request could not be completed.'
    throw new ApiError(typeof payload?.message === 'string' ? payload.message : fallback, response.status, payload)
  }
  if (responseType === 'blob') return response.blob()
  return payload
}

export const api = {
  me: (options) => apiRequest('/api/auth/me', options),
  login: (body) => apiRequest('/api/auth/login', { method: 'POST', body }),
  register: (body) => apiRequest('/api/auth/register', { method: 'POST', body }),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),
  getProfile: () => apiRequest('/api/profile/me'),
  createProfile: (body) => apiRequest('/api/profile', { method: 'POST', body }),
  updateProfile: (body) => apiRequest('/api/profile/me', { method: 'PATCH', body }),
  getLinks: () => apiRequest('/api/profile/me/links'),
  createLink: (body) => apiRequest('/api/profile/me/links', { method: 'POST', body }),
  updateLink: (id, body) => apiRequest(`/api/profile/me/links/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  deleteLink: (id) => apiRequest(`/api/profile/me/links/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  reorderLinks: (linkIds) => apiRequest('/api/profile/me/links/reorder', { method: 'PATCH', body: { linkIds } }),
  publicProfile: (slug) => apiRequest(`/api/public/profiles/${encodeURIComponent(slug)}`),
  getAnalytics: (range = '7d') => apiRequest(`/api/analytics?range=${encodeURIComponent(range)}`),
  analyticsChat: (body) => apiRequest('/api/assistant/chat', { method: 'POST', body }),
  exportXml: () => apiRequest('/api/profile/me/export.xml', { responseType: 'blob' }),
  validateXml: (xml) => apiRequest('/api/profile/me/import/validate', { method: 'POST', body: { xml } }),
  importXml: (xml) => apiRequest('/api/profile/me/import', { method: 'POST', body: { xml, confirm: true } }),
}

export { API_BASE_URL }
