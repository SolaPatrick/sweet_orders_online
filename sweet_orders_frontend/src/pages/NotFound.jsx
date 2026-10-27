import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container page error-page">
      <div className="error-code">404</div>
      <h1>Page not found</h1>
      <p className="muted">The page you opened does not exist or was moved.</p>
      <div className="actions center">
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
        <Link to="/menu" className="btn">
          Browse the menu
        </Link>
      </div>
    </div>
  )
}
