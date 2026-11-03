import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  ['/admin', 'Dashboard', true, false],
  ['/admin/orders', 'Orders', false, false],
  ['/admin/products', 'Products', false, true],
  ['/admin/categories', 'Categories', false, true],
  ['/admin/slots', 'Time slots', false, true],
  ['/admin/delivery-zones', 'Delivery areas', false, true],
  ['/admin/addons', 'Cake add-ons', false, true],
  ['/admin/payments', 'Payments', false, true],
  ['/admin/reviews', 'Reviews', false, true],
  ['/admin/users', 'Users', false, true],
  ['/admin/notifications', 'Notification log', false, true],
  ['/admin/sign-in-activity', 'Sign-in activity', false, true],
]

export default function AdminLayout() {
  const { logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <div className="admin">
      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <div className="admin-brand">
          {isAdmin ? "Clayanna's Admin" : "Clayanna's Staff"}
          <button type="button" className="nav-toggle light" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            ☰
          </button>
        </div>
        <nav onClick={() => setOpen(false)}>
          {LINKS.filter(([, , , adminOnly]) => isAdmin || !adminOnly).map(([to, text, end]) => (
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
