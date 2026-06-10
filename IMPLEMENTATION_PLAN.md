# Bakeoff 2 Implementation Plan

## Chosen architecture
- Framework: Astro
- Architecture: Static rendering with client-side interactivity
- Backend: Existing Express API server for authentication and data operations
- Database: JSON-backed sample data (`data.json`) with session-based authentication

## Goals for MVP
- User authentication: sign up, login, logout
- Core feature: rental room listings, landlord listing management, renter inquiries, and rent payments
- Responsive UI for desktop and mobile
- Client-side validation and server-side error handling
- Static front-end using Astro with hydration via browser JavaScript

## Task list
1. Create a new branch: `bakeoff-2`
2. Add Astro as the static front-end framework
3. Build a static page shell in `src/pages/index.astro`
4. Keep the existing Express backend as the API server
5. Add scripts for frontend and backend development
6. Document how to run both servers locally
7. Preserve the current core features and data model
8. Validate registration, login, listings, messaging, and payments

## Running the prototype
- Backend: `npm run dev:backend`
- Frontend: `npm run dev:frontend`
- Full local development: `npm run dev`

## Notes
- Astro will statically render the landing page and app shell.
- Existing `public/app.js` will hydrate the static page and provide the interactive MVP features.
- The Express server continues to support the API endpoints used by the client.
