# FRC Scouting Web App

A Preact + Vite + Firebase web app for collecting match data with Google sign-in, admin assignments, and offline-safe local storage.

## Quick start

1. Install dependencies:

```sh
npm install
```

2. Create `.env` from the template and fill with your Firebase project values:

```sh
cp .env.example .env
```

Set the values for `VITE_FIREBASE_*` in `.env` using your Firebase console.

3. Run the dev server:

```sh
npm run dev
```

## Features

- Google authentication (Firebase Auth)
- Role-based admin dashboard (stored in Firestore `users` collection)
- Admin can assign scouts to static matches
- Scouting form for 3v3 teams per match with fuel/climb/penalty fields
- Submissions stored in Firestore and cached in `localStorage` for offline resilience
- Pending submissions list with manual sync and delete controls

## Data model

- `users/{uid}`: `{ uid, displayName, email, role: 'admin'|'scout', assignedMatchId? }`
- `submissions/{autoId}`: form payload plus metadata (creator, match, alliance, timestamps)

## Notes

- Default matches are in `src/data/matches.ts` (replace with event schedule or live source later).
- Roles: first-time sign-in is `scout`; promote a user to admin from the dashboard.
- Firestore rules are not included—secure access before production.
