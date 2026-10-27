# Sweet Orders Online: LavaLust API

Backend for Sweet Orders Online, the cake and pastry ordering site for Clayanna's Café.
Built on LavaLust 4 (PHP MVC). The React site lives in `sweet_orders_frontend`.
Framework notes: [LAVALUST.md](LAVALUST.md).

It covers the five integrations in the project plan:

| Integration | Where |
|---|---|
| Online ordering (FR3, FR7) | `Orders` controller, `Order_model` |
| Payment gateway: PayMongo GCash/card (FR5) | `app/libraries/Paymongo.php`, `Payments` webhook |
| Product catalog (FR2) | `Catalog` controller, `Product_model`, `Category_model` |
| Delivery/pickup scheduling (FR4) | `Slots` controller, `Slot_model` |
| Email/SMS notifications (FR6) | `app/libraries/Notifier.php` (SMTP + textbee or Vonage) |
| Product photo storage | `app/libraries/Cloudinary.php` (Cloudinary free plan; local `public/uploads` without a key) |

## Requirements

PHP 8.1 or newer with `pdo_mysql`, `curl`, `openssl` and `mbstring`, plus MySQL 8 or MariaDB 10.4+
(XAMPP includes everything; Aiven MySQL works for the deployed copy).

## Setup

### 1. Database (Navicat)

1. Connect to your MySQL server in Navicat (XAMPP, or Aiven with SSL).
2. XAMPP: create a database named `sweet_orders` (utf8mb4). Aiven: use `defaultdb`.
3. Open that database, click **New Query**, paste all of [database/sweet_orders.sql](database/sweet_orders.sql) and **Run**.
   It creates the 11 ERD tables and adds the starter menu (5 categories, 9 products with cake options)
   and three weeks of pickup and delivery slots. Running it again resets these tables.

### 2. `.env`

Copy `.env.example` to `.env` and fill in the values. The file explains each key.

| Must fill in | What to put |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Same values as your Navicat connection |
| `DB_SSL_CA` | Aiven only: path to the downloaded `ca.pem` |
| `APP_KEY`, `JWT_SECRET`, `REFRESH_TOKEN_KEY` | Three different random strings, 32+ characters each |

Optional. Each one falls back to a safe test mode when empty:

| Keys | When empty |
|---|---|
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` | Payments run in **simulate mode**: orders are marked paid at once (method "Test payment") |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `CAFE_EMAIL` | Emails are only written to the notification log |
| `TEXTBEE_API_KEY`, `TEXTBEE_DEVICE_ID` (or the Vonage keys) | SMS are only written to the notification log |

Never commit `.env`; it is already in `.gitignore`.

### 3. Run

```bash
php lava serve        # http://127.0.0.1:3000
```

Open `http://localhost:3000/api/health`. It should show `"database": "connected"` and `"tables_found": "11 of 11"`.

XAMPP instead: copy the folder to `C:\xampp\htdocs\sweet_orders_backend`, set
`APP_URL=http://localhost/sweet_orders_backend`, and use the same URL as `VITE_API_URL` in the React app.

### 4. Make an admin account

Register on the website (Register page), then run this in Navicat with your email:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

Log out and in again; the account menu now shows **Admin panel**.

## PayMongo (sandbox)

1. In the PayMongo dashboard (test mode), copy the secret key `sk_test_...` into `PAYMONGO_SECRET_KEY`.
2. Add a webhook for the event `checkout_session.payment.paid` pointing to
   `https://<your-api>/api/payments/webhook`, and put its secret `whsk_...` in `PAYMONGO_WEBHOOK_SECRET`.
3. Checkout sends customers to PayMongo. When they come back, the order page also asks PayMongo
   for the result, so payments are confirmed even when the webhook cannot reach a local computer.

Amounts are sent in centavos and are always recomputed by the server from the database prices.

## Routes

All routes are in [app/config/routes.php](app/config/routes.php). `{id}` only matches numbers.
Every response is JSON; unknown routes return a JSON 404.

| Module | Method and path | Controller | Pages |
|---|---|---|---|
| Info | `GET /`, `GET /api`, `GET /api/health` | Home, Health | |
| Accounts (FR1) | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`; `GET`, `PUT /api/auth/me` | Auth | Register, Login, Profile |
| Catalog (FR2) | `GET /api/categories`, `/api/products`, `/api/products/{id}` | Catalog | Home, Menu, Product |
| Scheduling (FR4) | `GET /api/slots`, `/api/slots/dates` | Slots | Checkout |
| Ordering (FR3, FR7) | `POST /api/orders`; `GET /api/orders`, `/api/orders/{id}`; `POST /api/orders/{id}/pay`, `/cancel` | Orders | Cart, Checkout, My orders, Order details |
| Payments (FR5) | `POST /api/payments/webhook` | Payments | Order confirmed, Payment failed |
| Contact | `POST /api/contact` | Contact | Contact |
| Admin (FR8) | `GET /api/admin/dashboard` | Admin | Dashboard |
| | `GET /api/admin/orders`, `/orders/{id}`; `PUT /orders/{id}/status` | Admin | Orders, Order detail |
| | `GET`, `POST /api/admin/products`; `GET`, `PUT`, `DELETE /products/{id}`; `POST /products/{id}/image` | Admin | Products, Product form |
| | `GET`, `POST /api/admin/categories`; `PUT`, `DELETE /categories/{id}` | Admin | Categories |
| | `GET /api/admin/slots`; `POST /slots/generate`, `/slots/block-date`; `PUT`, `DELETE /slots/{id}` | Admin | Time slots |
| | `GET /api/admin/payments`, `/notifications`; `POST /notifications/{id}/resend` | Admin | Payments, Notification log |

Customer routes need `Authorization: Bearer <token>` from login; `/api/admin/*` also needs the admin role (403 otherwise).

## How it is built

- `app/kernel/MY_Api_Controller.php`: base for every controller. CORS and security headers, MySQL
  connection (Philippine time), JSON responses, login checks, and server-side validation that
  answers **422** with a message per field.
- `app/models/`: one model per table group (users, categories, products and options, slots, orders, payments, notifications).
  Queries use LavaLust's query builder or prepared statements.
- `app/controllers/`: Auth, Catalog, Slots, Orders, Payments, Contact, Health, Home, Admin.
- `app/libraries/Paymongo.php` and `app/libraries/Notifier.php`: the two outside services.
- Order rules: prices and the delivery fee are computed on the server, a slot is booked atomically
  so it can never be overbooked, unpaid orders release their slot after `ORDER_HOLD_MINUTES`,
  and status moves Paid → Preparing → Ready for pickup / Out for delivery → Completed, with an
  email and SMS at each step.
- Deleting a category with products, a slot with orders, or lowering a slot below its bookings is refused with **409** and a clear message.

## Deploying (Render + Aiven)

Render has no built-in PHP, so the API deploys as a **Docker** web service (Root Directory `LavaLust`).
The `Dockerfile` serves `public/` with Apache on Render's `PORT`; `.dockerignore` keeps `.env` out of the image.
On Render, set the same keys as `.env` under Environment, with `APP_ENV=production`, `TRUST_PROXY=1`,
`APP_URL` = the API's Render URL, `FRONTEND_URL` and `CORS_ORIGINS` = the React site's URL, the Aiven
database values, and `DB_SSL_CA=ca.pem` (the Aiven CA certificate saved in this folder; a relative path is read from here).

Free Render services sleep after 15 minutes idle, wipe uploaded photos on restart, and block SMTP ports
465 and 587 (use a provider that accepts port 2525, such as Brevo).
Set `CLOUDINARY_URL` so product photos are stored on Cloudinary (free plan) instead of Render's disk.
