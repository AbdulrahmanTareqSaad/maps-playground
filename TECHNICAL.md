# MapsLap — Technical Documentation

An interactive map playground built as a **pnpm monorepo** with two workspace apps: a **Next.js 15** frontend and a **Cloudflare Workers** speech-to-text service.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Monorepo Structure](#monorepo-structure)
- [Tech Stack](#tech-stack)
- [Frontend](#frontend)
- [API Routes](#api-routes)
- [STT Worker](#stt-worker)
- [External Services](#external-services)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [CI/CD Pipeline](#cicd-pipeline)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Vercel (Edge)                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Next.js 15 Frontend                     │  │
│  │                                                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │   OSM    │  │ Routing  │  │ Tracking │  │Geofencing│  │  │
│  │  │Explorer  │  │Playground│  │ Simulator│  │  Zones   │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │  │
│  │       │              │              │              │         │  │
│  │  ┌────┴──────────────┴──────────────┴──────────────┴─────┐  │  │
│  │  │              API Routes (BFF Layer)                   │  │  │
│  │  └────┬──────────┬──────────┬───────────┬───────────────┘  │  │
│  └───────┼──────────┼──────────┼───────────┼──────────────────┘  │
│          │          │          │           │                     │
│          ▼          ▼          ▼           ▼                     │
│     Nominatim    OSRM     In-Memory    Overpass                  │
│     Overpass     ORS       Stores      ORS API                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers (Edge)                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  STT Worker (Hono)                                        │  │
│  │  ├── Whisper (Workers AI)                                  │  │
│  │  ├── Cohere Transcribe API                                │  │
│  │  └── Llama 3.1 8B (Workers AI — enhancement)             │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
maps-playground/
├── apps/
│   ├── frontend/          # Next.js 15 app (App Router)
│   │   ├── app/
│   │   │   ├── api/       # 14 API routes (BFF)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── globals.css
│   │   ├── components/    # React components
│   │   │   ├── modules/   # Feature modules (OSM, Routing, Tracking, Geofencing, Styles)
│   │   │   ├── ui.tsx     # Shared UI primitives
│   │   │   └── MapView.tsx
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities, stores, i18n, theme, config
│   │   └── types/         # TypeScript interfaces
│   │
│   └── stt-worker/        # Cloudflare Worker (speech-to-text)
│       └── src/index.ts   # Hono app with 3 endpoints
│
├── package.json           # Root workspace scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vercel.json            # Vercel deployment config
└── .github/workflows/ci.yml
```

**Package manager:** pnpm ≥ 10.4.1 with workspaces
**Node version:** ≥ 22

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | 15.3 |
| **UI Library** | React | 19.1 |
| **Map Engine** | Leaflet.js | 1.9.4 |
| **Styling** | Tailwind CSS + inline styles | 4.1 |
| **Language** | TypeScript | 5.8 |
| **ID Generation** | nanoid | 5.x |
| **STT Worker** | Hono (on Cloudflare Workers) | 4.7 |
| **Frontend Deploy** | Vercel | — |
| **Worker Deploy** | Cloudflare Workers | — |

---

## Frontend

### Modules

The app is a single-page application with five switchable modules:

| Module | Description |
|---|---|
| **Map Explorer** | Search nearby amenities (cafes, fuel, parking, etc.) via Overpass API. Supports geocoding, voice search, and custom Overpass QL queries. |
| **Routing** | Compare driving routes from ORS vs OSRM. Generate isochrone (travel-time) polygons. All points are draggable on the map. |
| **Live Tracking** | Simulate a GPS tracker moving along a route with real-time SSE updates. Exposes a REST API token for external position reporting. |
| **Geo-fencing** | Draw polygon zones on the map, save them, and run point-in-polygon checks. |
| **Map Styles** | Switch between 4 free raster tile layers (OSM, Carto Light/Dark, Hydda). |

### Shared UI Components (`components/ui.tsx`)

Extracted reusable primitives used across all modules:
`Input`, `NumberInput`, `Label`, `SectionTitle`, `Subtitle`, `H3`, `Divider`, `Button`, `ResultsBox`, `StatusBanner`, `ErrorBanner`, `FieldGroup`, `CoordInput`

### Theme System (`lib/theme.ts`)

Centralized design tokens for colors, gradients, radii, font sizes, spacing, and map defaults. All module components reference these constants instead of hardcoded values.

### Internationalization

- English (`lib/i18n/en.ts`) and Arabic (`lib/i18n/ar.ts`) with full RTL support
- Language toggled via a context provider (`LangProvider`)
- `LangHtml` component syncs `lang` and `dir` attributes on `<html>`

### Key Hooks

| Hook | Purpose |
|---|---|
| `useDraggablePoints` | Creates draggable Leaflet markers with bidirectional state sync and double-click repositioning |

---

## API Routes

All routes are Next.js App Router API handlers acting as a **Backend-for-Frontend (BFF)** layer. They proxy requests to external services, keeping API keys server-side.

### OSM Module

| Method | Endpoint | External API | Description |
|---|---|---|---|
| `GET` | `/api/osm/geocode` | Nominatim | Forward geocoding — converts place name to coordinates |
| `GET` | `/api/osm/query` | Overpass API | Queries OSM for amenities within a radius |

**`/api/osm/geocode` params:** `q` (required), `limit` (max 10), optional `lat`/`lng` for viewbox bias

**`/api/osm/query` params:** `lat`, `lng`, `radius_km` (default 1), `amenity` (one of: `cafe`, `fuel`, `parking`, `pharmacy`, `school`, `hospital`, `atm`, `bus_stop`, `charging`, `custom`), `custom_query` (for custom Overpass QL)

### Routing Module

| Method | Endpoint | External API | Description |
|---|---|---|---|
| `GET` | `/api/routing/osrm` | OSRM Public | Free driving route (no API key) |
| `GET` | `/api/routing/ors` | OpenRouteService | Multi-modal route (key required) |
| `POST` | `/api/routing/isochrone` | OpenRouteService | Travel-time polygon generation (key required) |

**ORS/ORSM params:** `start` (lat,lng), `end` (lat,lng), `profile` (`driving-car` | `cycling-regular` | `foot-walking`)

**Isochrone body:** `{ lat, lng, range (minutes), profile }`

### Tracking Module

| Method | Endpoint | Storage | Description |
|---|---|---|---|
| `POST` | `/api/tracking/create` | In-memory | Create a tracker with start/end points |
| `GET` | `/api/tracking/list` | In-memory | List all active trackers |
| `GET` | `/api/tracking/[id]` | In-memory | Get tracker by ID |
| `DELETE` | `/api/tracking/[id]` | In-memory | Delete tracker |
| `GET` | `/api/tracking/stream/[id]` | SSE | Real-time position stream |
| `POST` | `/api/tracking/report` | In-memory | External GPS device position report |

**SSE Events:** `position` (lat,lng per tick), `history` (path points), `arrived` (destination reached), `tracker_error`

**Position report body:** `{ tracker_id, api_token, lat, lng }`

### Geofencing Module

| Method | Endpoint | Storage | Description |
|---|---|---|---|
| `POST` | `/api/geofence/create` | In-memory | Create a polygon zone |
| `GET` | `/api/geofence/list` | In-memory | List all zones |
| `DELETE` | `/api/geofence/[id]` | In-memory | Delete a zone |
| `POST` | `/api/geofence/check` | In-memory | Point-in-polygon test |

**Create body:** `{ name, polygon: [{lat, lng}, ...] }` (min 3 points)
**Check body:** `{ lat, lng }`

---

## STT Worker

A **Cloudflare Worker** built with [Hono](https://hono.dev/) that provides speech-to-text transcription with two engine options and optional LLM-based post-processing.

### Endpoints

| Method | Endpoint | Content-Type | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/transcribe` | `audio/*` | Transcribe raw audio body |
| `POST` | `/transcribe-form` | `multipart/form-data` | Transcribe audio from form upload |

### Transcription Engines

| Engine | Model | Provider | Notes |
|---|---|---|---|
| **Whisper** (default) | `@cf/openai/whisper` | Cloudflare Workers AI | Runs on Cloudflare's edge, no external API key needed |
| **Cohere** | `cohere-transcribe-03-2026` | Cohere API | Requires `COHERE_API_KEY` |

### Post-Transcription Enhancement

When `enhance=true`, the raw transcript is sent through **Llama 3.1 8B** (`@cf/meta/llama-3.1-8b-instruct-fp8`) via Cloudflare Workers AI to correct transcription errors, fill in missing punctuation, and improve readability.

### Request Parameters

**Query params / form fields:**

| Param | Values | Default | Description |
|---|---|---|---|
| `engine` | `whisper` \| `cohere` | `whisper` | Transcription engine |
| `language` | ISO 639-1 code | `en` | Audio language |
| `enhance` | `true` \| `false` | `false` | Enable LLM post-processing |

---

## External Services

| Service | Purpose | Auth | Free Tier |
|---|---|---|---|
| **Nominatim** | Geocoding (place name → coordinates) | User-Agent header | Yes (rate-limited) |
| **Overpass API** | Query OpenStreetMap for POIs/amenities | None | Yes |
| **OSRM** | Driving route calculation | None | Yes (public instance) |
| **OpenRouteService** | Multi-modal routing + isochrone analysis | `ORS_API_KEY` | 2000 req/day |
| **Cloudflare Workers AI** | Whisper STT + Llama 3.1 enhancement | Cloudflare binding | 10,000 req/day |
| **Cohere API** | Alternative STT engine | `COHERE_API_KEY` | 1000 req/month |

---

## Environment Variables

### Frontend (`apps/frontend/.env`)

| Variable | Scope | Description |
|---|---|---|
| `ORS_API_KEY` | Server | OpenRouteService API key (required for ORS routing + isochrone) |
| `NEXT_PUBLIC_POINT1_LAT` | Client | Default primary location latitude |
| `NEXT_PUBLIC_POINT1_LNG` | Client | Default primary location longitude |
| `NEXT_PUBLIC_POINT2_LAT` | Client | Default secondary location latitude |
| `NEXT_PUBLIC_POINT2_LNG` | Client | Default secondary location longitude |
| `NEXT_PUBLIC_STT_WORKER_URL` | Client | Cloudflare Workers STT endpoint URL |

### STT Worker (`.dev.vars` / Cloudflare Secrets)

| Variable | Description |
|---|---|
| `COHERE_API_KEY` | Cohere API key for the `cohere` transcription engine |

### CI/CD (GitHub Secrets)

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | For `wrangler deploy` |
| `VERCEL_TOKEN` | For `vercel --prod` deployment |

---

## Deployment

### Frontend → Vercel

- Configured in `vercel.json`
- Build command: `pnpm --filter frontend build`
- Output: `apps/frontend/.next`
- Install: `pnpm install --frozen-lockfile`

### STT Worker → Cloudflare Workers

- Configured in `wrangler.jsonc`
- Uses `nodejs_compat` compatibility flag
- Workers AI binding (`AI`) is automatically available
- Deploy: `wrangler deploy`

---

## CI/CD Pipeline

Defined in `.github/workflows/ci.yml`, triggered on push/PR to `main`:

```
┌─────────────────┐     ┌──────────────┐     ┌───────────────────┐
│  lint-typecheck  │────▶│    build      │────▶│ deploy-frontend   │ (push only)
│                  │     │              │     │ deploy-stt-worker │ (push only)
│  - pnpm install │     │  - next build│     │                   │
│  - typecheck    │     │  - wrangler  │     │  - vercel --prod  │
│  - lint         │     │    dry-run   │     │  - wrangler deploy│
└─────────────────┘     └──────────────┘     └───────────────────┘
```

- **Concurrency:** Only one pipeline per branch; in-progress runs are cancelled
- **Node:** 22
- **pnpm:** 10.4.1 (via `pnpm/action-setup`)
- **Deploys only on push** (not on PRs)

---

## Data Storage

All tracking and geofencing data is stored **in-memory** on the Next.js server. This means:

- Data persists across API calls within the same server process
- Data is **lost on server restart** or cold start
- Suitable for demos and development; not for production persistence

The two stores are:
- `lib/tracking-store.ts` — tracker CRUD, position simulation, arrival detection
- `lib/geofence-store.ts` — zone CRUD, ray-casting point-in-polygon algorithm
