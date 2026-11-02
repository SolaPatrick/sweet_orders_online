import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ErrorBox, Loader } from '../components/ui'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const { user, setUser } = useAuth()
  const [state, setState] = useState(token ? { busy: true } : { error: new Error('This link is missing its code. Open the link from the email again.') })
  const sent = useRef(false)

  useEffect(() => {
    if (!token || sent.current) return
    sent.current = true
    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then((res) => {
        setState({ message: res.message })
        if (user && res.user?.id === user.id) setUser(res.user)
      })
      .catch((error) => setState({ error }))
  }, [token, user, setUser])

  return (
    <div className="container page narrow">
      <div className="card result">
        <div className="result-icon">{state.message ? '✓' : state.error ? '!' : '…'}</div>
        <h1>{state.message ? 'Email verified' : state.error ? 'We could not verify your email' : 'Verifying your email'}</h1>
        {state.busy && <Loader text="Checking your link…" />}
        {state.message && <p className="muted">{state.message}</p>}
        <ErrorBox error={state.error} />
        <div className="actions center">
          <Link to={user ? '/profile' : '/login'} className="btn btn-primary">
            {user ? 'Go to my profile' : 'Log in'}
          </Link>
          <Link to="/menu" className="btn">
            Back to menu
          </Link>
        </div>
      </div>
    </div>
  )
}
