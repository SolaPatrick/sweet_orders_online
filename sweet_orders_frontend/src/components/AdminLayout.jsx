import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  ['/admin', 'Dashboard', true],
  ['/admin/orders', 'Orders'],
  ['/admin/products', 'Products'],
  ['/admin/categories', 'Categories'],
  ['/admin/slots', 'Time slots'],
  ['/admin/payments', 'Payments'],
  ['/admin/notifications', 'Notification log'],
]

export default function AdminLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <div className="admin">
      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <div className="admin-brand">
          Clayanna's Admin
          <button type="button" className="nav-toggle light" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            ☰
          </button>
        </div>
        <nav onClick={() => setOpen(false)}>
          {LINKS.map(([to, text, end]) => (
            <NavLink key={to} to={to} end={end}>
              {text}
            </NavLink>
          ))}
          <hr />
          <Link to="/">View site</Link>
          <button
            type="button"
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
          >
            Log out
          </button>
        </nav>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
