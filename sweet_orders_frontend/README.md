# Sweet Orders Online: React site

Customer website and café admin panel for Clayanna's Café, built with React 19, Vite and React Router.
It talks to the LavaLust API in the `LavaLust` folder.

## Run locally

1. Start the API first (`php lava serve` in the LavaLust folder, see its README).
2. In this folder:

```bash
cp .env.example .env     # VITE_API_URL = address of the API, e.g. http://localhost:3000
npm install
npm run dev              # http://localhost:5173
```

`npm run build` makes the production files in `dist/`. `npm run lint` checks the code.

If the site says it cannot reach the server, check that the API is running, that `VITE_API_URL`
matches it, and that `CORS_ORIGINS` in the API's `.env` includes `http://localhost:5173`.
Restart `npm run dev` after editing `.env`.

## Pages

Routes are in [src/App.jsx](src/App.jsx).

| Customer | Path | Admin (café staff) | Path |
|---|---|---|---|
| Home | `/` | Dashboard | `/admin` |
| Menu (search, category, price filter) | `/menu` | Orders (filters, status) | `/admin/orders` |
| Product details and options | `/products/:id` | Order detail and status update | `/admin/orders/:id` |
| Cart | `/cart` | Products list | `/admin/products` |
| Checkout (pickup/delivery, slot, pay) | `/checkout` | Add / edit product, photo, options | `/admin/products/new`, `/admin/products/:id/edit` |
| Order confirmed | `/order-confirmed/:id` | Categories | `/admin/categories` |
| Payment failed | `/payment-failed/:id` | Time slots | `/admin/slots` |
| Login, Register | `/login`, `/register` | Payments | `/admin/payments` |
| My orders, Order details | `/orders`, `/orders/:id` | Notification log | `/admin/notifications` |
| Profile | `/profile` | | |
| About, Contact | `/about`, `/contact` | | |

Logged-out visitors are sent to Login for account pages; customers who open `/admin` see Access denied.

## How it is built

- `src/api/client.js`: one `api()` helper for every request. It adds the login token,
  refreshes it when it expires, and turns API errors (including the 422 field errors) into `ApiError`.
- `src/context/`: `AuthContext` (logged-in user) and `CartContext` (cart saved in the browser).
- `src/components/ui.jsx`: shared pieces such as `useApi`, form `Field`, `ConfirmDialog`
  (asked before every delete or cancel), status badges, pagination and loaders.
- `src/pages/` and `src/pages/admin/`: one file per page.
- Forms show the server's validation message under each field. Prices shown in the cart are
  only previews; the API recomputes every total.
