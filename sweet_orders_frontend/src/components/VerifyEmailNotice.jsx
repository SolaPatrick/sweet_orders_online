import { useState } from 'react'
import { api } from '../api/client'

export default function VerifyEmailNotice({ email, children }) {
  const [state, setState] = useState({})

  const resend = async () => {
    setState({ busy: true })
    try {
      const res = await api('/auth/verify-email/resend', { method: 'POST', body: {} })
      setState({ message: res.message })
    } catch (err) {
      setState({ error: err.message })
    }
  }

  return (
    <div className="alert alert-warning verify-notice">
      <div>
        {children || (
          <>
            Your email <strong>{email}</strong> is not verified yet.
          </>
        )}
      </div>
      <div className="row wrap">
        <button type="button" className="btn btn-small" disabled={state.busy} onClick={resend}>
          {state.busy ? 'Sending…' : 'Resend verification email'}
        </button>
        {state.message && <span className="small">{state.message}</span>}
        {state.error && <span className="field-error">{state.error}</span>}
      </div>
    </div>
  )
}
