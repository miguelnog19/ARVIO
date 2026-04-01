# ARVIO Web App

A React + TypeScript web application for ARVIO, reusing the same Supabase backend as the Android TV app.

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** — build tool
- **TailwindCSS** — utility-first styling
- **React Router v6** — client-side routing
- **@supabase/supabase-js** — Supabase client
- **Lucide React** — icons

## Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
cd web
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Find these values in your [Supabase project settings](https://supabase.com/dashboard/project/_/settings/api).

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build

```bash
npm run build
npm run preview  # preview the production build
```

## Architecture

```
src/
├── api/           # Supabase client + Edge Function callers (tmdb, watchlist)
├── components/    # Reusable UI (Navbar, MediaCard, MediaRow, Layout, etc.)
├── context/       # React context providers (AuthContext)
├── hooks/         # Custom hooks (useAuth, useWatchlist, useMediaSearch)
├── pages/         # Route-based pages
│   ├── HomePage.tsx
│   ├── SearchPage.tsx
│   ├── MovieDetailPage.tsx
│   ├── TvDetailPage.tsx
│   ├── WatchlistPage.tsx
│   ├── SettingsPage.tsx
│   ├── LoginPage.tsx
│   └── SignupPage.tsx
└── types/         # TypeScript interfaces (TMDB, Supabase)
```

## Shared Backend

This web app connects to the **same Supabase project** as the ARVIO Android TV app:

| Resource | Used By |
|---|---|
| Supabase Auth | Login, session management |
| `watchlist` table | Add/remove/view watchlist |
| `tmdb-proxy` Edge Function | All TMDB API calls |
| `trakt-proxy` Edge Function | Trakt API (future) |
| `profiles` table | User profile (future) |

## Routes

| Path | Page |
|---|---|
| `/` | Home (trending + popular rows) |
| `/search` | Search movies & TV |
| `/movie/:id` | Movie details |
| `/tv/:id` | TV show details |
| `/watchlist` | User watchlist |
| `/settings` | Profile & settings |
| `/login` | Login |
| `/signup` | Signup |
