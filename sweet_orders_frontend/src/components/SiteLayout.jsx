import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { Preloader, Stripes } from './Motion'
import { useScrollProgress } from '../lib/motion'

function AccountMenu() {
  const { user, isStaff, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  return (
    <div className="account-menu" ref={ref}>
      <button type="button" className="btn btn-small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {user.name.split(' ')[0]} ▾
      </button>
      {open && (
        <div className="menu" onClick={() => setOpen(false)}>
          {isStaff && <Link to="/admin">Admin panel</Link>}
          <Link to="/orders">My orders</Link>
          <Link to="/profile">Profile</Link>
          <button
            type="button"
            onClick={async () => {
              await logout()
              navigate('/')
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

export default function SiteLayout() {
  const { user } = useAuth()
  const { count } = useCart()
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()
  const [navPath, setNavPath] = useState(location.pathname)
  const footerRef = useRef(null)
  useScrollProgress(footerRef)

  if (navPath !== location.pathname) {
    setNavPath(location.pathname)
    setNavOpen(false)
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="site">
      <Preloader />
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <strong>Clayanna's</strong>
            <span>Café</span>
          </Link>
          <button type="button" className="nav-toggle" aria-label="Menu" onClick={() => setNavOpen((o) => !o)}>
            ☰
          </button>
          <nav className={`site-nav ${navOpen ? 'open' : ''}`}>
            <NavLink to="/menu">Menu</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            <NavLink to="/cart" className="cart-link">
              Cart <span className="count">{count}</span>
            </NavLink>
            {user ? (
              <AccountMenu />
            ) : (
              <>
                <NavLink to="/login">Login</NavLink>
                <Link to="/register" className="btn btn-primary btn-small">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="site-main">
        <div key={location.pathname} className="route-fade">
          <Outlet />
        </div>
      </main>
      <footer ref={footerRef} className="site-footer">
        <Stripes className="footer-stripes" />
        <div className="container footer-top">
          <p className="footer-word">Clayanna's</p>
          <Link to="/menu" className="btn btn-light btn-lg">
            Order now
          </Link>
        </div>
        <div className="container footer-inner">
          <span>© {new Date().getFullYear()} Clayanna's Café · Sweet Orders Online</span>
          <nav>
            <Link to="/menu">Menu</Link>
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/policies/terms">Terms</Link>
            <Link to="/policies/cancellation">Cancellation</Link>
            <Link to="/policies/privacy">Privacy</Link>
            <a href="https://facebook.com" target="_blank" rel="noreferrer">
              Facebook
            </a>
            <span>0917 000 0000</span>
          </nav>
          <p className="footer-note">
            This website was made for a school project and is for educational purposes only. It is not an official online store of Clayanna's Café.
          </p>
        </div>
      </footer>
    </div>
  )
}
