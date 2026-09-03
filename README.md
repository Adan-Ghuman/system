# Ghuman Textile ERP

A comprehensive, modern Enterprise Resource Planning (ERP) system purpose-built for textile manufacturing, knitting, dyeing operations, fabric inventory management, and multi-party ledger accounting.

---

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Zustand, Lucide React
- **Backend**: Node.js, Express, TypeScript, Mongoose, JWT (Access + Refresh Tokens), Cookie-Parser, ExcelJS
- **Database**: MongoDB Atlas (Cloud)
- **Deployment**: Vercel (Edge CDN + Serverless Function API)

---

## Core Modules

- **Party Management**: Master directory of Knitters, Dyeing Mills, Fabric Buyers, and Yarn Clients with real-time balance tracking.
- **Knitting Operations**: Inward fabric tracking, outward yarn issuance to knitters, box/weight management, and 1% wastage reconciliations.
- **Dyeing Batch Tracking**: Batch workflows for Ghumman Dyeing Mill and Rajput Dyeing Mill with Ecru vs. Finish weight shortage analytics.
- **Fabric Inventory**: Multi-location stock monitoring (ZR Godown, Ghumman Mill, Rajput Mill) across Raw Ecru and Finished Dyed states.
- **Dispatch & Billing**: Dual billing support for 18% Sales Tax (GST) and Commercial (Non-GST) deliveries with automated roll tracking.
- **Accounts & Ledgers**: Automated debit/credit party ledgers, payment receipts, and bank transfer vouchers.

---

## Project Structure

```text
Ghuman_system/
├── api/                  # Vercel serverless function entrypoint
├── client/               # Vite + React frontend SPA
├── server/               # Express backend API & Mongoose models
│   ├── src/
│   │   ├── config/       # Database & environment configuration
│   │   ├── models/       # Mongoose schemas (Party, DyeingBatch, etc.)
│   │   ├── modules/      # Business logic & route controllers
│   │   └── scripts/      # Data migration & seeding scripts
├── package.json          # Root orchestration scripts
├── vercel.json           # Vercel routing & build configuration
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm
- MongoDB Atlas cluster connection string

### 1. Clone & Install
```bash
git clone <repository-url>
cd Ghuman_system

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `server/` directory (refer to `server/.env.example`):

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/ghuman_textile_erp?retryWrites=true&w=majority
JWT_ACCESS_SECRET=your_jwt_access_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Run Locally
From the root directory:
```bash
# Start backend (runs on http://localhost:5000)
npm run dev:server

# In a new terminal, start frontend (runs on http://localhost:5173)
npm run dev:client
```

---

## Default Admin Credentials

Upon initial database seeding, a default administrator account is established:

- **Email**: `admin@gmail.com`
- **Password**: `12345678`

---

## Deployment on Vercel

1. Push your repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add the following **Environment Variables** in Vercel Project Settings:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = `<your-mongodb-atlas-uri>`
   - `JWT_ACCESS_SECRET` = `<secure-secret>`
   - `JWT_REFRESH_SECRET` = `<secure-secret>`
   - `CLIENT_ORIGIN` = `https://<your-vercel-domain>.vercel.app`
4. Deploy. Vercel will automatically build both the serverless API and client bundle according to `vercel.json`.
