
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')

const TOKENS_KEY = 'sweet_orders_tokens'

export class ApiError extends Error {
  constructor(message, status, errors = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

export function getTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY)) || null
  } catch {
    return null
  }
}

export function setTokens(tokens) {
  if (tokens) localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  else localStorage.removeItem(TOKENS_KEY)
}

let refreshing = null

async function refreshTokens() {
  const tokens = getTokens()
  if (!tokens?.refresh_token) return false
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('refresh failed')
        const data = await res.json()
        setTokens(data.tokens)
        return true
      })
      .catch(() => {
        setTokens(null)
        window.dispatchEvent(new Event('sweet-orders-logout'))
        return false
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

export async function api(path, { method = 'GET', body, query, retry = true } = {}) {
  let url = `${API_URL}/api${path}`
  if (query) {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, v)
    })
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  const headers = { Accept: 'application/json' }
  const tokens = getTokens()
  if (tokens?.access_token) headers.Authorization = `Bearer ${tokens.access_token}`

  let payload
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(url, { method, headers, body: payload })
  } catch {
    throw new ApiError('Cannot reach the server. Check that the API is running and VITE_API_URL is correct.', 0)
  }

  if (res.status === 401 && retry && tokens?.refresh_token && !path.startsWith('/auth/')) {
    if (await refreshTokens()) return api(path, { method, body, query, retry: false })
  }

  let data
  const text = await res.text()
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    const message = data?.error === 'Unauthorized' ? 'Please log in to continue.' : data?.error
    throw new ApiError(message || `Request failed (${res.status})`, res.status, data?.errors || {})
  }
  return data
}
