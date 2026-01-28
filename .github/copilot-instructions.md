# Copilot Instructions for FRC Scouting Web App

## Project Overview
Preact + Vite + Firebase web app for real-time FRC match scouting with role-based access control, offline resilience, and conflict resolution for duplicate submissions.

**Tech Stack:** Preact 10, Firebase (Auth + Firestore), TypeScript, Vite

## Key Commands
- `npm run dev` – Start dev server on http://localhost:5173
- `npm run build` – Compile TypeScript + bundle with Vite
- `npm install` – Install dependencies (Firebase, Preact, build tools)

## Architecture Patterns

### Role-Based Access Control
- **`UserProfile`** (Firestore `users/{uid}`) stores role: `'scout'` | `'moderator'` | `'admin'`
- First sign-in creates scout by default; admins promote users via dashboard
- `App.tsx` has `isAdmin` / `isModerator` memos that gate dashboard visibility
- Key: assignment flow is **match → team → scout**, managed by admins only

### Data Flow: Submission Lifecycle
1. **Scout submits form** → `ScoutingForm.tsx` collects `SubmissionData` (fuel scored/missed, climb level, penalties)
2. **Offline cache** → `storage.ts` queues to `localStorage` if offline; `PendingSync.tsx` lists pending + retry/delete UI
3. **Firestore upload** → `Submission` doc in `submissions/{autoId}` with `status: 'pending'`
4. **Moderator review** → `SubmissionReview.tsx` approves/rejects; status → `'approved'` | `'rejected'`
5. **Aggregation** → `aggregation.ts` builds `MatchStats` from approved submissions, detecting conflicts per field

### Conflict Resolution
- **Trigger:** Multiple scouts submit different values for same team field → `ConflictField` created
- **Detection:** `detectConflicts()` groups submissions by field, skips default values (see `fields.ts`)
- **Storage:** Conflicts live in `MatchStats` doc; resolution UI in `ConflictResolver.tsx` (pick best value)
- **Key:** nested field paths (e.g., `'auton.fuelScored'`) extracted by `getAllFieldPaths()` in `utils/nested.ts`

## Core Types & Collections

```typescript
// Firestore Collections:
users/{uid}: UserProfile
submissions/{autoId}: Submission (with status: pending|approved|rejected)
matches/{id}: Match (static list from src/data/matches.ts, or Firestore-synced)
matchStats/{id}: MatchStats (conflict aggregation)

// Key Types:
SubmissionData: { teamNumber, alliance, auton{fuelScored/Missed, climbLevel}, teleop{...}, teamPenalties, opponentPenalties }
Submission: SubmissionData + metadata (createdBy, matchId, status, approvedBy, notes)
TimingPhase: { fuelScored, fuelMissed, climbLevel } — used in auton + teleop
```

## Component Structure

| Component | Purpose | Data Dependencies |
|-----------|---------|-------------------|
| `App.tsx` | Top-level auth, role routing, tab UI | Firebase Auth, Firestore users/matches |
| `AdminDashboard.tsx` | Assign scouts to teams/matches, manage roles | Firestore users |
| `ScoutingForm.tsx` | Input form (fuel, climb, penalties) | Local form state |
| `SubmissionReview.tsx` | Approve/reject pending submissions | Firestore submissions |
| `MatchStatsManager.tsx` | Resolve conflicts, finalize team stats | Firestore matchStats |
| `PendingSync.tsx` | UI for offline queue + sync/delete | `localStorage` + Firestore |
| `ConflictResolver.tsx` | Pick field value when conflicts detected | `MatchStats.conflicts[]` |
| `MySubmissions.tsx` | Scout views own submissions history | Firestore submissions (filter by uid) |
| `ModeratorDashboard.tsx` | View/manage submissions & conflicts | Firestore submissions + matchStats |

## Environment Setup
Create `.env` with Firebase config (copy from `.env.example`):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Offline-First Patterns
- **localStorage key:** `'pending-submissions'` stores `Submission[]`
- **Functions:** `loadPendingSubmissions()`, `addPendingSubmission()`, `removePendingSubmission()`
- **Retry flow:** User manually triggers sync via `PendingSync` button or auto-syncs on reconnect
- **Timestamp normalization:** `normalizeSubmission()` converts Firestore Timestamp → milliseconds

## Utilities
- **`nested.ts`:** `getNestedValue(obj, 'auton.fuelScored')` / `setNestedValue()` for field access
- **`fields.ts`:** `DEFAULT_VALUES` dict, `isDefaultValue()` to skip, `FIELD_LABELS` for UI display
- **`submission.ts`:** `normalizeSubmission()` adapts Firestore Timestamp format

## Common Workflows for AI Agents

### Add a new form field:
1. Update `SubmissionData` type in `types.ts`
2. Add default to `DEFAULT_VALUES` and label to `FIELD_LABELS` in `fields.ts`
3. Add input in `ScoutingForm.tsx`
4. Aggregation & conflict detection auto-detect via `getAllFieldPaths()`

### Add a new admin feature:
1. Check auth: verify `isAdmin || isModerator` before rendering
2. Use Firestore queries (see `AdminDashboard.tsx` patterns: `getDocs()`, `updateDoc()`, `setDoc()`)
3. Update local state post-mutation for immediate UI feedback

### Debug submission sync issues:
1. Check `localStorage['pending-submissions']` (DevTools → Application)
2. Verify Firebase rules allow read/write to `submissions`, `users`, `matchStats`
3. Check `normalizeSubmission()` timestamp handling if aggregation stalls
