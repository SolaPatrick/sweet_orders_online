import { Route, Routes } from 'react-router-dom'
import './App.css'
import SiteLayout from './components/SiteLayout'
import AdminLayout from './components/AdminLayout'
import { RequireAdmin, RequireAuth } from './components/Guards'
import Home from './pages/Home'
import Menu from './pages/Menu'
import ProductDetails from './pages/ProductDetails'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmed from './pages/OrderConfirmed'
import PaymentFailed from './pages/PaymentFailed'
import Login from './pages/Login'
import Register from './pages/Register'
import MyOrders from './pages/MyOrders'
import OrderDetails from './pages/OrderDetails'
import Profile from './pages/Profile'
import About from './pages/About'
import Contact from './pages/Contact'
import NotFound from './pages/NotFound'
import AccessDenied from './pages/AccessDenied'
import Dashboard from './pages/admin/Dashboard'
import AdminOrders from './pages/admin/Orders'
import AdminOrderDetail from './pages/admin/OrderDetail'
import AdminProducts from './pages/admin/Products'
import ProductForm from './pages/admin/ProductForm'
import Categories from './pages/admin/Categories'
import Slots from './pages/admin/Slots'
import Payments from './pages/admin/Payments'
import Notifications from './pages/admin/Notifications'

// Page codes (C1–C15, A1–A9) match the Sweet Orders Online site map.
export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<Menu />} />
        <Route path="products/:id" element={<ProductDetails />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
        <Route path="order-confirmed/:id" element={<RequireAuth><OrderConfirmed /></RequireAuth>} />
        <Route path="payment-failed/:id" element={<RequireAuth><PaymentFailed /></RequireAuth>} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="orders" element={<RequireAuth><MyOrders /></RequireAuth>} />
        <Route path="orders/:id" element={<RequireAuth><OrderDetails /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="403" element={<AccessDenied />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id/edit" element={<ProductForm />} />
        <Route path="categories" element={<Categories />} />
        <Route path="slots" element={<Slots />} />
        <Route path="payments" element={<Payments />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Routes>
  )
}
