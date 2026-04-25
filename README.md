# Campus Ditto HK

Campus Ditto HK is a **TypeScript + React + Tailwind + Express** full-stack demo inspired by the high-conversion product rhythm of weekly "match drops", specifically redesigned for **Hong Kong universities**.

> [!IMPORTANT]
> This project has been upgraded with a **Modern Dark Theme** and modular architecture for better scalability.

## 🌟 Key Features

- **Premium Dark UI**: High-impact aesthetics with vibrant pink accents and glassmorphism.
- **Bi-lingual Support**: Seamless English / Cantonese toggle.
- **University Verification**: Simulated email onboarding flow for HK universities.
- **Weekly Match Drops**: Wednesday-focused matching logic.
- **AI-Inspired UI**: Compatibility scoring, curated date spots, and feedback loops.
- **Admin Dashboard**: Full control over student records and matchmaking cycles.

## 📂 Project Structure (Refactored)

```txt
hk-campus-ditto/
├── frontend/             # Upgraded React 19 + Vite + Tailwind UI
│   ├── src/
│   │   ├── components/   # Reusable UI (Layout, SectionCard, etc.)
│   │   ├── pages/        # Modular page views (HomePage, AdminPage, etc.)
│   │   ├── assets/       # High-quality visual assets
│   │   └── lib/          # API & Session utilities
├── backend/              # Express + TypeScript API
└── scripts/              # Automation & Dev scripts
```

## 🚀 Quick Start

### 1) Initialize & Run
You can use the provided convenience script to set up everything:

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

### 2) Manual Commands
If you prefer running step-by-step:

| Step | Command | Description |
| :--- | :--- | :--- |
| **All deps** | `npm install && npm --prefix backend install && npm --prefix frontend install` | Install all dependencies |
| **Seed** | `npm run seed` | Reset and populate demo data |
| **Start** | `npm run demo` | Launch Backend (8787) & Frontend (5173) |

## 🛠 Interaction & Development

### When to restart?
- **Backend changes**: The backend has auto-reload enabled. No restart needed for code changes.
- **Frontend changes**: Vite HMR (Hot Module Replacement) handles UI changes instantly.
- **Database schema changes**: If you modify `backend/src/persistence.ts`, you should run `npm run seed` to reset the file-based storage.

### Testing Verification
The dev verification code is:
```txt
246810
```

## 📦 Build for Production

```bash
npm run build
```

---
**Maintained by Antigravity AI Coding Assistant.**
