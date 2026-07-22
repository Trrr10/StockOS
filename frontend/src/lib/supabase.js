import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
console.log('SUPABASE URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('SUPABASE KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY)
// ─── Supabase client ──────────────────────────────────────────────────────────
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    realtime: { params: { eventsPerSecond: 10 } },
  }
)

// ─── Axios API client (auto-attaches Supabase JWT) ───────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
  timeout: 30000,
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') err.message = detail
    else if (detail?.message)       err.message = detail.message
    return Promise.reject(err)
  }
)

export default api