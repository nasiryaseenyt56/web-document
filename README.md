# doc_web_store

A modern, full-stack digital storefront and management platform for publishing, purchasing, and managing digital documents (PDFs, guides, templates) and curated websites/web projects.

Built with **React 19**, **TypeScript**, **Tailwind CSS**, **Express.js**, and **Firebase Firestore/Auth**.

---

## 🌟 Features Overview

### 🛒 Buyer Experience
- **Digital Documents Catalog**: Browse, search, and filter free and paid digital documents.
- **Curated Websites Showcase**: Explore web projects, preview live websites, and unlock premium links.
- **Easy Payment Submission**: Pay via local payment accounts (EasyPaisa, JazzCash, Bank Transfer), upload payment receipts/screenshots, and submit Transaction IDs (TID).
- **Order Tracking ("My Orders")**: View pending, approved, or rejected orders with real-time status updates.
- **Instant Secure Downloads**: Free items and verified paid documents can be downloaded immediately with single-click access.

### 🛡️ Admin Portal (`/admin`)
- **Direct Admin Login**: The admin navbar button is discreetly hidden from public view. Admin logs in directly via the standard Sign In / Sign Up popup by entering:
  - **Full Name**: Admin Email (`nasiryaseen2011@gmail.com`)
  - **Phone Number**: Admin Phone (`03060217399`)
- **Complete Item Management**:
  - Add new digital documents (with file uploads) or website listings.
  - **Edit** existing items: Title, description, price, free/pay type, URLs, and replace document attachments.
  - **Delete** items with in-app confirmation modal.
- **Order Verification & Approval**:
  - Review submitted payments, inspect receipt screenshots with full zoom preview.
  - One-click **Approve** (unlocks buyer download instantly) or **Reject** with reason.
- **Store Settings & Payment Accounts**:
  - Configure payment instructions, EasyPaisa, JazzCash, and bank account numbers displayed to customers during checkout.

---

## 🚀 Preventing 404 Errors on Refresh (SPA Deployment)

When deploying single-page applications (SPAs) with client-side routing (React Router), refreshing on subpaths like `/my-orders` or `/admin` can trigger a 404 "Page Not Found" error if the hosting server isn't configured for SPA fallback.

This repository includes built-in configurations for all major deployment platforms:

| Platform | Configuration File | Behavior |
| :--- | :--- | :--- |
| **Node.js / Express (Cloud Run, VPS, Docker)** | `server.ts` (`app.get('*', ...)`) | Express catches all non-API GET requests and serves `dist/index.html`. |
| **Netlify / Cloudflare Pages** | `public/_redirects` | `/* /index.html 200` automatically copies into `dist/_redirects` during build. |
| **Vercel** | `vercel.json` | Rewrites all incoming paths (`/(.*)`) to `/index.html`. |
| **Firebase Hosting** | `firebase.json` | Global rewrite rule rewrites `**` to `/index.html`. |

---

## 🛠️ Project Structure

```
├── data/
│   └── store.json          # Persistent local database store for items, orders, and users
├── public/
│   ├── _redirects          # SPA fallback rule for Netlify/Cloudflare
│   └── assets/             # Public static assets & sample files
├── server/
│   └── db.ts               # Server-side database access and business logic
├── src/
│   ├── components/         # Reusable UI components (Navbar, Footer, Modals)
│   ├── context/            # AuthContext and StoreContext
│   ├── lib/                # Firebase client integration
│   ├── pages/              # Views (Home, ItemDetails, MyOrders, AdminPortal, AdminLogin)
│   ├── types.ts            # TypeScript data models and interfaces
│   ├── App.tsx             # Root router configuration
│   └── main.tsx            # Application entry point
├── uploads/                # Directory for uploaded payment receipts and documents
├── firebase.json           # Firebase Hosting and Firestore configuration
├── vercel.json             # Vercel SPA routing rules
├── server.ts               # Production Express API + Vite integration server
└── vite.config.ts          # Vite configuration with Tailwind CSS
```

---

## 💻 Local Development & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
The server will start at `http://localhost:3000` with hot-reload enabled.

### 3. Build for Production
```bash
npm run build
```
This compiles:
1. Client-side static assets into `dist/` via Vite.
2. Server entry point into `dist/server.cjs` via esbuild.

### 4. Run Production Build
```bash
npm start
```
Starts the production server on port 3000 with complete SPA fallback routing enabled.

---

## 🔐 Admin Credentials Summary

- **Default Admin Email**: `nasiryaseen2011@gmail.com`
- **Default Admin Phone**: `03060217399`
- **Portal Access**: Log in via the Sign In modal on the top-right by providing the admin email in the name input and the admin phone number.

---

## 📄 License
MIT License. Built with Google AI Studio.
