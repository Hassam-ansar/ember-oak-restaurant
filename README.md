# Ember & Oak — Restaurant Management & Online Food Ordering System

A complete, full-stack Restaurant Management, Online Food Ordering, POS Terminal, Kitchen Display System (KDS), Inventory & Recipe Cost Engine, and Delivery Rider Dispatch Platform.

---

## 1. Architecture & Folder Structure

- `/backend/models/schemas.ts` — 15 Mongoose / MongoDB schemas (`User`, `Category`, `Product`, `Order`, `Payment`, `Refund`, `InventoryItem`, `Supplier`, `Staff`, `Expense`, `Coupon`, `Review`, `RestaurantSettings`, `AuditLog`).
- `/backend/db/seedData.ts` — Sample seed data clearly tagged with `isDemo: true` for separation from production data.
- `/backend/db/datastore.ts` — Hybrid persistence engine supporting MongoDB Atlas (`MONGODB_URI`) with automatic fallback to an embedded JSON-backed Mongoose-validated store (`/backend/data/database.json`).
- `/backend/middleware/auth.ts` — JWT token signing, verification, and Role-Based Access Control (RBAC) for `owner`, `manager`, `cashier`, `kitchen`, `rider`, and `customer`.
- `/backend/routes/api.ts` — Express REST API endpoints + Socket.IO real-time event broadcasting + server-side price, tax, coupon, delivery zone, and recipe COGS calculations.
- `/server.ts` — Express + HTTP + Socket.IO + Vite full-stack server on Port `3000`.
- `/src/components/` — Modular React views:
  - `CustomerStorefront.tsx` — Storefront, search, filters, product customizer (sizes, crusts, toppings, add-ons), cart drawer, coupon validator, checkout, live order tracker, and 1-click reorder.
  - `PosTerminal.tsx` — Walk-in, takeaway, and phone order entry, cash/card/online payment tendered calculator, 80mm thermal receipt printer, and refund processor.
  - `KitchenDisplay.tsx` — Live KDS board with preparation timers, special instructions, and status progression that deducts recipe ingredients from inventory.
  - `DeliveryRiderPanel.tsx` — Rider assignment, route dispatch, and COD cash collection.
  - `AdminDashboard.tsx` — Chart.js revenue & order charts (Daily, Weekly, Monthly, Yearly), PDF & Excel (.xlsx) report exports, Menu & Recipe CRUD, Inventory restock & wastage, Staff attendance & payroll, Expenses, Coupons, and Demo vs. Production dataset switcher.

---

## 2. Setup & Installation Instructions

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and set your `MONGODB_URI` (MongoDB Atlas or local MongoDB), `JWT_SECRET`, and `DATA_MODE` (`demo` or `production`).
3. **Start Full-Stack Development Server:**
   ```bash
   npm run dev
   ```
4. **Run End-to-End Workflow Verification Test:**
   ```bash
   npx tsx backend/tests/workflow.test.ts
   ```
5. **Production Build & Start:**
   ```bash
   npm run build
   npm start
   ```

---

## 3. REST API Documentation

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/bootstrap` | Public | Loads categories, products, delivery zones, active coupons, reviews, and riders |
| `POST` | `/api/auth/login` | Public | Authenticates user with bcrypt and returns signed JWT |
| `POST` | `/api/auth/register` | Public | Registers customer account with 100 bonus loyalty points |
| `POST` | `/api/auth/quick-switch` | Public | Returns signed JWT for any role (`owner`, `manager`, `cashier`, `kitchen`, `rider`, `customer`) |
| `POST` | `/api/products` | Owner, Manager | Creates new menu product with customizations and recipe ingredients |
| `PUT` | `/api/products/:id` | Owner, Manager, Kitchen | Updates product details, price, recipe, or availability |
| `DELETE` | `/api/products/:id` | Owner, Manager | Deletes a menu product |
| `POST` | `/api/coupons/validate` | Public | Validates promo code, minimum order subtotal, and calculates discount |
| `POST` | `/api/orders/calculate` | Public | Server-side calculation of item options, subtotal, discount, tax, delivery fee, and recipe COGS |
| `POST` | `/api/orders` | Public / Auth | Creates order, records payment, awards loyalty points, and broadcasts `order:created` |
| `PATCH` | `/api/orders/:id/status` | Staff | Updates status (`Pending` → `Confirmed` → `Preparing` → `Ready` → `Out for Delivery` → `Delivered`) and deducts recipe stock |
| `PATCH` | `/api/orders/:id/assign-rider` | Staff | Assigns a delivery rider to an order |
| `PATCH` | `/api/orders/:id/collect-cash` | Rider, Cashier | Marks COD or POS cash collected and records payment |
| `POST` | `/api/orders/:id/refund` | Owner, Manager, Cashier | Refunds and cancels an order with audit logging |
| `POST` | `/api/inventory/:id/adjust` | Owner, Manager, Kitchen | Restocks ingredient (with optional automatic expense entry) or logs wastage |
| `GET` | `/api/analytics` | Staff | Computes real revenue, AOV, recipe COGS, gross/net profit, bestsellers, and Chart.js series |
| `POST` | `/api/admin/data-mode` | Owner | Switches between `demo` seed dataset and clean `production` mode |
