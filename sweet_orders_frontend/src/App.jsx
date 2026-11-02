import { Route, Routes } from 'react-router-dom'
import './App.css'
import SiteLayout from './components/SiteLayout'
import AdminLayout from './components/AdminLayout'
import { RequireAdmin, RequireAuth, RequireStaff } from './components/Guards'
import Home from './pages/Home'
import Menu from './pages/Menu'
import ProductDetails from './pages/ProductDetails'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmed from './pages/OrderConfirmed'
import PaymentFailed from './pages/PaymentFailed'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import MyOrders from './pages/MyOrders'
import OrderDetails from './pages/OrderDetails'
import Profile from './pages/Profile'
import About from './pages/About'
import Contact from './pages/Contact'
import NotFound from './pages/NotFound'
import AccessDenied from './pages/AccessDenied'
import VerifyEmail from './pages/VerifyEmail'
import Policies from './pages/Policies'
import Dashboard from './pages/admin/Dashboard'
import AdminOrders from './pages/admin/Orders'
import AdminOrderDetail from './pages/admin/OrderDetail'
import AdminProducts from './pages/admin/Products'
import ProductForm from './pages/admin/ProductForm'
import Categories from './pages/admin/Categories'
import Slots from './pages/admin/Slots'
import Payments from './pages/admin/Payments'
import Notifications from './pages/admin/Notifications'
import Users from './pages/admin/Users'
import DeliveryZones from './pages/admin/DeliveryZones'
import Addons from './pages/admin/Addons'
import Reviews from './pages/admin/Reviews'

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
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="policies" element={<Policies />} />
        <Route path="policies/:slug" element={<Policies />} />
        <Route path="orders" element={<RequireAuth><MyOrders /></RequireAuth>} />
        <Route path="orders/:id" element={<RequireAuth><OrderDetails /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="403" element={<AccessDenied />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="admin" element={<RequireStaff><AdminLayout /></RequireStaff>}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="products" element={<RequireAdmin><AdminProducts /></RequireAdmin>} />
        <Route path="products/new" element={<RequireAdmin><ProductForm /></RequireAdmin>} />
        <Route path="products/:id/edit" element={<RequireAdmin><ProductForm /></RequireAdmin>} />
        <Route path="categories" element={<RequireAdmin><Categories /></RequireAdmin>} />
        <Route path="slots" element={<RequireAdmin><Slots /></RequireAdmin>} />
        <Route path="delivery-zones" element={<RequireAdmin><DeliveryZones /></RequireAdmin>} />
        <Route path="addons" element={<RequireAdmin><Addons /></RequireAdmin>} />
        <Route path="payments" element={<RequireAdmin><Payments /></RequireAdmin>} />
        <Route path="reviews" element={<RequireAdmin><Reviews /></RequireAdmin>} />
        <Route path="users" element={<RequireAdmin><Users /></RequireAdmin>} />
        <Route path="notifications" element={<RequireAdmin><Notifications /></RequireAdmin>} />
      </Route>
    </Routes>
  )
}
