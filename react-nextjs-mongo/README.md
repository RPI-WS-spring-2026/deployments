# React + Next.js + MongoDB Variant

**Stack:** Next.js (App Router) with API Route Handlers + Mongoose | **Port:** 3003 | **Database:** MongoDB

## What This Teaches

This variant demonstrates **Next.js as a full-stack framework** — no separate Express server needed:

- **API Route Handlers** — `route.js` files that handle HTTP methods (GET, POST, PUT, DELETE)
- **Mongoose in Next.js** — Connection singleton pattern using `global.mongoose` to avoid reconnection on every request
- **Model Guards** — `mongoose.models.Project || mongoose.model()` to prevent recompilation errors during hot reload
- **Same-Origin API** — Frontend and backend on the same port, no CORS needed

## Key Differences from the Full-Stack Variant

| Concept | Full Stack (Next.js + Express + MongoDB) | This Variant |
|---------|------------------------------------------|--------------|
| Backend | Separate Express server (port 3000) | Next.js API Route Handlers (same port) |
| API URL | `process.env.NEXT_PUBLIC_API_URL` (cross-origin) | No base URL needed (same origin) |
| DB Connection | Express `connectDB()` on startup | Mongoose singleton with `global` cache |
| Models | CommonJS (`require`) | ES Modules (`import`) with recompilation guard |
| CORS | Required (different ports) | Not needed (same origin) |
| Deployment | 2 services (client + server) | 1 service |

## Running Locally

```bash
# Start MongoDB (use Docker or local install)
docker run -d -p 27017:27017 --name mongo mongo:7

# Install and run
npm install
npm run dev
# Opens on http://localhost:3003
```

## Running with Docker

From the parent `samples/` directory:

```bash
docker compose up react-nextjs-mongo mongo
```

## File Structure

```
react-nextjs-mongo/
├── next.config.js
├── jsconfig.json
├── Dockerfile
└── src/
    ├── lib/
    │   ├── db.js              # Mongoose connection singleton
    │   └── api.js             # Client-side fetch (no base URL)
    ├── models/
    │   ├── Project.js         # Mongoose model with recompilation guard
    │   └── Task.js            # Mongoose model with recompilation guard
    ├── app/
    │   ├── layout.js          # Root layout
    │   ├── globals.css        # Shared styles
    │   ├── page.js            # Home page
    │   ├── api/
    │   │   ├── projects/
    │   │   │   ├── route.js           # GET all, POST
    │   │   │   └── [id]/
    │   │   │       ├── route.js       # GET one, PUT, DELETE
    │   │   │       └── tasks/
    │   │   │           └── route.js   # GET tasks, POST task
    │   │   └── tasks/
    │   │       └── [id]/
    │   │           └── route.js       # GET, PUT, DELETE task
    │   └── projects/
    │       ├── page.js                # Projects list
    │       ├── new/
    │       │   └── page.js            # Create project
    │       └── [id]/
    │           ├── page.js            # Project detail + tasks
    │           └── edit/
    │               └── page.js        # Edit project
```
