import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { collection, doc, getDoc, query, setDoc, onSnapshot } from 'firebase/firestore'
import './app.css'
import { auth, db, googleProvider } from './firebase'
import { matches as staticMatches } from './data/matches'
import { AdminDashboard } from './components/AdminDashboard'
import { ModeratorDashboard } from './components/ModeratorDashboard'
import { PendingSync } from './components/PendingSync'
import { ScoutingForm } from './components/ScoutingForm'
import { SubmissionReview } from './components/SubmissionReview'
import { MySubmissions } from './components/MySubmissions'
import { MatchStatsManager } from './components/MatchStatsManager'
import type { Match, Submission, SubmissionData, UserProfile } from './types'
import {
  addPendingSubmission,
  clearPendingSubmissions,
  loadPendingSubmissions,
  removePendingSubmission,
} from './storage'

export function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [pending, setPending] = useState<Submission[]>([])
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [activeTab, setActiveTab] = useState('scouting')

  useEffect(() => {
    setPending(loadPendingSubmissions())
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'matches'))
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows: Match[] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Match))
        setMatches(rows.sort((a, b) => a.start - b.start))
      },
      (err) => {
        console.error('Failed to load matches', err)
        setMatches(staticMatches)
      },
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      if (user) {
        const userProfile = await ensureUserProfile(user)
        setProfile(userProfile)
        // Load all users for moderator/admin dashboard with real-time updates
        if (userProfile.role === 'admin' || userProfile.role === 'moderator') {
          const unsub2 = onSnapshot(
            collection(db, 'users'),
            (snapshot) => {
              const rows: UserProfile[] = snapshot.docs.map((d) => d.data() as UserProfile)
              setUsers(rows)
            },
            (err) => {
              console.error('Failed to load users', err)
            },
          )
          return () => unsub2()
        }
      } else {
        setProfile(null)
        setUsers([])
      }
    })

    return () => unsub()
  }, [])

  const isAdmin = useMemo(() => profile?.role === 'admin', [profile?.role])
  const isModerator = useMemo(() => profile?.role === 'moderator', [profile?.role])

  // Set default tab based on role
  useEffect(() => {
    if (isAdmin || isModerator) {
      setActiveTab('review')
    } else {
      setActiveTab('scouting')
    }
  }, [isAdmin, isModerator])

  async function ensureUserProfile(user: FirebaseUser): Promise<UserProfile> {
    const ref = doc(db, 'users', user.uid)
    const snap = await getDoc(ref)
    const baseProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || user.email || 'Scout',
      email: user.email || 'unknown',
      role: 'scout',
    }

    if (!snap.exists()) {
      await setDoc(ref, baseProfile)
      return baseProfile
    }

    return { ...baseProfile, ...(snap.data() as UserProfile) }
  }

  async function handleSignIn() {
    setStatus('Opening Google sign-in…')
    try {
      await signInWithPopup(auth, googleProvider)
      setStatus(null)
    } catch (err) {
      console.error('Sign-in failed', err)
      const code = (err as { code?: string })?.code

      if (code === 'auth/popup-blocked') {
        setStatus('Popup blocked; redirecting…')
        await signInWithRedirect(auth, googleProvider)
        return
      }

      if (code === 'auth/popup-closed-by-user') {
        setStatus('Popup closed—please try again')
        return
      }

      setStatus(`Sign-in failed${code ? ` (${code})` : ''}`)
    }
  }

  async function handleSignOut() {
    setStatus(null)
    await signOut(auth)
  }

  async function handleSubmit(values: SubmissionData) {
    if (!firebaseUser || !profile?.assignedMatchId) {
      setStatus('Missing assignment')
      return
    }

    const submission: Submission = {
      id: crypto.randomUUID(),
      matchId: profile.assignedMatchId,
      data: values,
      createdAt: Date.now(),
      createdBy: firebaseUser.uid,
      createdByName: profile.displayName,
      status: 'pending',
    }

    addPendingSubmission(submission)
    setPending(loadPendingSubmissions())
    setStatus('Saved locally; syncing…')

    try {
      const { id, ...payload } = submission
      await setDoc(doc(db, 'submissions', id), payload)
      removePendingSubmission(submission.id)
      setPending(loadPendingSubmissions())
      setStatus('Submitted for review')
    } catch (err) {
      console.error('Failed to upload, kept locally', err)
      setStatus('Offline? Kept locally until sync succeeds')
    }
  }

  async function syncPending() {
    if (pending.length === 0 || !firebaseUser) return
    setSyncing(true)
    setStatus(null)
    for (const item of pending) {
      try {
        const { id, ...payload } = item
        await setDoc(doc(db, 'submissions', id), payload)
        removePendingSubmission(id)
      } catch (err) {
        console.error('Failed to sync item', item.id, err)
      }
    }
    setPending(loadPendingSubmissions())
    setSyncing(false)
    setStatus('Sync attempt finished')
  }

  function clearLocal() {
    clearPendingSubmissions()
    setPending([])
  }

  return !firebaseUser ? (
    // Login page for unauthenticated users
    <div class="login-page">
      <div class="login-container">
        <div class="logo-container">
          <div class="logo-placeholder">6901</div>
        </div>
        <div class="team-branding">
          <h1 class="team-number">6901</h1>
          <p class="team-name">Scouting</p>
        </div>
        <div class="login-action">
          <button onClick={handleSignIn}>Sign in with Google</button>
        </div>
        {status && <p class="toast">{status}</p>}
      </div>
    </div>
  ) : (
    <div class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">Team 6901</p>
          <h1>Competition Scouting</h1>
        </div>
        <div class="actions">
          <div class="chip">
            <span class="dot" />
            <div>
              <div class="strong">{profile?.displayName || firebaseUser.email}</div>
              <div class="muted small">{profile?.role || 'scout'}</div>
            </div>
          </div>
          <button class="ghost" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {status && <p class="toast">{status}</p>}
      {/* Tab Navigation */}
      <nav class="tabs">
        {!isAdmin && !isModerator && (
          <>
            <button
              class={activeTab === 'scouting' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('scouting')}
            >
              Scouting
            </button>
            <button
              class={activeTab === 'submissions' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('submissions')}
            >
              My Submissions
            </button>
          </>
        )}
        {(isModerator || isAdmin) && (
          <>
            <button
              class={activeTab === 'review' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('review')}
            >
              Review Submissions
            </button>
            <button
              class={activeTab === 'stats' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('stats')}
            >
              Match Stats
            </button>
            <button
              class={activeTab === 'matches' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('matches')}
            >
              Match Management
            </button>
            {isAdmin && (
              <button
                class={activeTab === 'assignments' ? 'tab active' : 'tab'}
                onClick={() => setActiveTab('assignments')}
              >
                Scout Assignments
              </button>
            )}
          </>
        )}
      </nav>

      {/* Tab Content */}
      {!isAdmin && !isModerator && (
        <>
          {activeTab === 'scouting' && (
            <>
              <PendingSync pending={pending} syncing={syncing} onSync={syncPending} onClear={clearLocal} />
              {profile?.assignedTeamNumber && profile?.assignedAlliance ? (
                <ScoutingForm
                  teamNumber={profile.assignedTeamNumber}
                  alliance={profile.assignedAlliance}
                  onSubmit={handleSubmit}
                />
              ) : (
                <section class="panel">
                  <header class="panel-header">
                    <div>
                      <p class="eyebrow">Scouting</p>
                      <h2>Waiting for team assignment</h2>
                      <p class="muted">Your admin will assign you to a team soon. Check back here.</p>
                    </div>
                  </header>
                </section>
              )}
            </>
          )}
          {activeTab === 'submissions' && <MySubmissions userId={firebaseUser.uid} pendingLocal={pending} />}
        </>
      )}
      {(isModerator || isAdmin) && (
        <>
          {activeTab === 'review' && <SubmissionReview />}
          {activeTab === 'stats' && <MatchStatsManager matches={matches} />}
          {activeTab === 'matches' && <ModeratorDashboard users={users} />}
          {activeTab === 'assignments' && isAdmin && <AdminDashboard matches={matches} />}
        </>
      )}
    </div>
  )
}
