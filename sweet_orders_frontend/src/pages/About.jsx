import { Link } from 'react-router-dom'

// C13 About
export default function About() {
  return (
    <div className="container page">
      <section className="hero">
        <div>
          <h1>About Clayanna's Café</h1>
          <p className="muted">A neighborhood bakery making custom cakes and fresh pastries since 2018. Every cake is baked to order.</p>
        </div>
        <div className="hero-photo placeholder">Café photo</div>
      </section>
      <div className="grid-3">
        <div className="card">
          <h3>Opening hours</h3>
          <p className="muted">Tue to Sun, 8:00 AM to 7:00 PM. Closed on Mondays.</p>
        </div>
        <div className="card">
          <h3>Pickup</h3>
          <p className="muted">Pick up your order at the counter during your chosen time slot.</p>
        </div>
        <div className="card">
          <h3>Delivery</h3>
          <p className="muted">Within the city for a flat fee. Custom cakes need 48 hours of notice.</p>
        </div>
      </div>
      <div className="two-col">
        <iframe
          className="map"
          title="Map"
          loading="lazy"
          src="https://www.openstreetmap.org/export/embed.html?bbox=120.97%2C14.58%2C121.0%2C14.6&layer=mapnik"
        />
        <div className="card">
          <h3>Find us</h3>
          <p className="muted">123 Mabini St., Poblacion, City, Philippines</p>
          <Link to="/menu" className="btn btn-primary">
            See the menu
          </Link>
        </div>
      </div>
    </div>
  )
}
