# SolarOps Intelligence — Enterprise Solar Installation Management System

**SolarOps Intelligence** is an end-to-end web platform designed for residential and commercial solar energy operations. It connects customers, field technicians, warehouse procurement, and system administrators into a unified, database-backed management system.

---

## Architecture Overview

* **Frontend:** React 19, TypeScript, Vite, Lucide Icons, Custom Solar SaaS Theme
* **Backend:** Node.js, Express, TypeScript, Zod, JWT (`jsonwebtoken`), Bcrypt (`bcryptjs`)
* **Database:** PostgreSQL (Port 5432, database `solarops`)
* **ORM:** Prisma ORM 5.22.0
* **ML / AI Preparation:** Modular interface layer (`ml/demand_forecast`) with advisory forecasting endpoints (`/api/ai/forecast-demand`)

```text
Solar-Installation-Management-System/
├── frontend/                        # Active React + TypeScript + Vite application
│   ├── src/
│   │   ├── components/              # AdminDashboard, CustomerDashboard, TechnicianDashboard, AuthModal, WarrantyModal
│   │   ├── context/AuthContext.tsx  # Authentication & role-state provider
│   │   ├── services/api.ts          # Central REST API client
│   │   ├── App.tsx                  # Application shell & routing
│   │   └── styles.css               # Shared SaaS styling system
│   └── package.json
├── backend/                         # Express + TypeScript + Prisma API
│   ├── prisma/seed.ts              # Optional, explicitly enabled demo reset/seed
│   ├── src/
│   │   ├── config/prisma.ts         # Prisma client singleton
│   │   ├── middleware/              # JWT auth and centralized error handler
│   │   ├── routes/                  # auth, admin, projects, surveys, estimates, inventory, checklists, services, warranties, payments, ai
│   │   ├── services/aiService.ts    # AI/ML integration layer
│   │   ├── tests/auth.test.ts       # Automated integration test suite
│   │   └── server.ts                # Express HTTP server
│   ├── .env.example
│   └── package.json
├── database/
│   └── schema.prisma                # PostgreSQL relational schema
└── ml/
    ├── demand_forecast/             # Python forecasting prototype & evaluation scripts
    └── photo_inspection/             # Dataset preparation and computer-vision training guide
```

---

## Key Features & Role-Based Workflows

### 1. Authentication & Role-Based Access Control
* **Common Login Page:** A single login page serving Customers, Administrators, and Technicians.
* **Customer Self-Registration:** Homeowners can create an account with automatic assignment to the `CUSTOMER` role (strict restriction prevents public registration for Admin or Technician).
* **Initial Admin Initialization:** Securely bootstrapped via environment secrets (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) with Bcrypt hashing.
* **Admin-Managed Technician Creation:** Only authenticated administrators can create certified technician accounts from the Admin Dashboard with temporary credentials.
* **Backend Authorization:** Server-side route middleware enforces strict access rules (Customers access only their own records, Technicians access assigned work, Admins access administrative functions).
* **1-Click Demo Evaluation:** The login modal includes convenient 1-click verified login buttons to evaluate Admin (`Aarav Kapoor`), Technician (`Arjun Nair`), or Customer (`Meera Sharma`) accounts.

### 2. End-to-End Solar Installation Workflow
1. **Request Creation:** Customer submits an installation request specifying capacity (kW), system type, and terrace address.
2. **Technician Assignment:** Admin reviews the request and dispatches a certified technician.
3. **Site Feasibility Survey:** Technician conducts roof measurement, evaluates shading, assesses structural feasibility, and submits findings.
4. **Quotation & Subsidy:** Admin generates a formal estimate with PM Surya Ghar national subsidy deductions.
5. **Customer Approval & Advance:** Customer reviews financial breakdown and approves quotation online, triggering advance payment.
6. **Installation & Interactive Checklist:** Technician executes 6-stage MNRE installation checklist (Mounting rails, Panel wiring, Inverter connection, Earthing resistance test, Net metering sync).
7. **Commissioning & Warranty Certificate:** When installation checklist reaches 100%, the project is marked `COMPLETED` and a verifiable 5-year system warranty certificate is auto-provisioned.
8. **Service Desk:** Customer can raise maintenance or inverter fault tickets; admin and technicians track resolution.

### 3. Warehouse Inventory & Planning
* Real-time stock balance tracking for panels, hybrid inverters, DC solar cables, mounting structures, and net meters.
* Reorder thresholds and low-stock visual indicators.
* Transactional stock adjustments with audit logging.

### 4. AI/ML Operations Layer
* Material-demand forecast prototype uses Linear Regression and Random Forest with synthetic sample history; displayed values are demonstrations only.
* Photo-inspection setup and dataset conversion script live in `ml/photo_inspection`; a trained checkpoint is not included yet.
* Model results are advisory and require human review; they do not automatically change inventory or financial records.

---

## Getting Started

### Prerequisites
* **Node.js:** v20+ or v26+
* **PostgreSQL:** Port 5432 running locally with user `postgres`

### 1. Backend Setup & Run

```bash
cd Solar-Installation-Management-System/backend

# 1. Install dependencies
npm install

# 2. Push schema to PostgreSQL
npm run db:push

# 3. Optional: seed an empty local demo database only. This deletes existing data.
#    Configure passwords in backend/.env and set ALLOW_DESTRUCTIVE_SEED=true first.
npm run db:seed

# 4. Run automated integration test suite
npm test

# 5. Start development backend server (Port 5000)
npm run dev
```

### 2. Frontend Setup & Run

```bash
cd Solar-Installation-Management-System/frontend

# 1. Install dependencies
npm install

# 2. Start Vite development server (Port 5173)
npm run dev
```

Open `http://localhost:5173/` in your browser.

---

## Local Accounts

Use the administrator email and password configured in your private `backend/.env` file. Do not commit `.env` files or publish account passwords. Optional demo accounts can be created only in a local development database with `npm run db:seed` from `backend/`.

---

## Automated Test Suite

Run the integration tests from the backend directory:
```bash
npm test
```
Verifies:
* PostgreSQL connection health
* Secure admin password validation
* Customer registration & Bcrypt hashing
* Duplicate email constraint enforcement
* JWT token issuance and role claims
* Customer installation request lifecycle
* Admin request querying
* Admin creation of technician accounts
