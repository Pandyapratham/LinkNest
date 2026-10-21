import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, ApiError } from './api'

afterEach(() => vi.unstubAllGlobals())
function response(status, body, contentType = 'application/json') {
  return { status, ok: status >= 200 && status < 300, headers: { get: () => contentType }, json: async () => JSON.parse(body), blob: async () => new Blob([body]) }
}

describe('central API client', () => {
  it('sends cookies and parses successful JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, JSON.stringify({ success: true, user: { username: 'demo' } })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiRequest('/api/auth/me')).resolves.toEqual({ success: true, user: { username: 'demo' } })
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('returns safe server messages and a fallback for malformed error bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(400, JSON.stringify({ success: false, message: 'Invalid input' }))))
    await expect(apiRequest('/api/profile/me')).rejects.toMatchObject({ name: 'ApiError', status: 400, message: 'Invalid input' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(502, 'not-json', 'text/plain')))
    await expect(apiRequest('/api/profile/me')).rejects.toBeInstanceOf(ApiError)
  })

  it('converts network errors to a safe message and preserves aborts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('private network detail')))
    await expect(apiRequest('/api/auth/me')).rejects.toThrow('Could not reach LinkNest')
    const abort = new DOMException('aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))
    await expect(apiRequest('/api/auth/me')).rejects.toBe(abort)
  })
})
