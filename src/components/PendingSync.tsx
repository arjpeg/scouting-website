import type { Submission } from '../types'

export function PendingSync({
    pending,
    syncing,
    onSync,
    onClear,
}: {
    pending: Submission[]
    syncing: boolean
    onSync: () => Promise<void>
    onClear: () => void
}) {
    if (pending.length === 0) return null

    return (
        <section class="panel warning">
            <header class="panel-header">
                <div>
                    <p class="eyebrow">Offline cache</p>
                    <h3>{pending.length} unsent submission{pending.length > 1 ? 's' : ''}</h3>
                    <p class="muted">We keep a local copy so nothing is lost; sync when you are online.</p>
                </div>
                <div class="actions">
                    <button class="ghost" disabled={syncing} onClick={onClear}>
                        Delete local copies
                    </button>
                    <button disabled={syncing} onClick={onSync}>
                        {syncing ? 'Syncing…' : 'Sync now'}
                    </button>
                </div>
            </header>
        </section>
    )
}
