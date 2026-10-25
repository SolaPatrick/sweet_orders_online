import { Link } from 'react-router-dom'

// C15 Access denied (non-admins who open /admin)
export default function AccessDenied() {
  return (
    <div className="container page error-page">
      <div className="error-code">403</div>
      <h1>Access denied</h1>
      <p className="muted">This page is for café staff only.</p>
      <div className="actions center">
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
        <Link to="/orders" className="btn">
          My orders
        </Link>
      </div>
    </div>
  )
}
