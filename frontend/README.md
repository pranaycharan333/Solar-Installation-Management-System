# SolarOps Intelligence — frontend demo

## Run it

Install Node.js (LTS), open a terminal in this folder, and run:

```sh
npm install
npm run dev
```

Open the local address Vite prints. The role selector in the upper-right previews Admin, Technician, and Customer screens. Forms and action buttons currently show demo notices; no customer data is saved and no backend is connected.

## Why these files exist

- `package.json` lists the app's libraries and the commands used to start/build it. React renders the interface, TypeScript catches many mistakes while editing, Vite serves the app during development, and Lucide supplies consistent icons.
- `index.html` is the browser's starting page; it provides the root element where React mounts the application.
- `vite.config.ts` tells Vite to process React's JSX syntax.
- `tsconfig.json` sets TypeScript's checks and browser language features.
- `src/main.tsx` starts React and loads the shared stylesheet.
- `src/App.tsx` contains the demo shell, role previews, dashboards, and clearly marked sample content. The sample records live here temporarily so they can later be replaced by a mock API module and then Bharath's real API.
- `src/styles.css` holds layout, colors, responsive behavior, and visual states separately from the screen logic.

## Technology choices

React lets us compose repeated UI pieces (for example metric cards and status badges) and update the view when the selected role changes. TypeScript gives names and shapes to shared concepts such as roles and project records, reducing accidental mismatches when the backend contract arrives. Vite has a small setup and fast local feedback. Plain CSS keeps the inspection demo easy to run without adding a UI framework dependency.

## Demo scope and integration notes

The role switch is only a presentation preview, not authentication or authorization. Backend permissions must still protect every API request. All displayed names, projects, inventory, and totals are illustrative mock data. Forecast and photo-analysis wording is advisory and calls for human review. Before connecting to Bharath's API, agree response shapes and move sample records behind a small service layer; put the API base URL in an environment variable such as `VITE_API_BASE_URL`.

Screen map: Admin → overview, projects, customer/team/inventory/service/report navigation; Technician → work queue and schedule; Customer → project journey, payments/warranty, service request.

## Lazy loading

`src/DashboardContent.tsx` contains the role dashboard components and sample records. `src/App.tsx` loads it with React `lazy()` and wraps it in `Suspense`, which shows a loading placeholder while the dashboard JavaScript chunk downloads. This demonstrates code splitting; for this small demo, the speed improvement may be modest.
