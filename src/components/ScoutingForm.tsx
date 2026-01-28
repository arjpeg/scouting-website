import { useState } from 'preact/hooks'
import type { SubmissionData, TimingPhase } from '../types'

const emptyPhase = (): TimingPhase => ({
    fuelScored: 0,
    fuelMissed: 0,
    climbLevel: 'none',
})

export function ScoutingForm({
    teamNumber,
    alliance,
    onSubmit,
}: {
    teamNumber: string
    alliance: 'red' | 'blue'
    onSubmit: (data: SubmissionData) => Promise<void>
}) {
    const [auton, setAuton] = useState<TimingPhase>(emptyPhase())
    const [teleop, setTeleop] = useState<TimingPhase>(emptyPhase())
    const [teamPenalties, setTeamPenalties] = useState(0)
    const [opponentPenalties, setOpponentPenalties] = useState(0)
    const [status, setStatus] = useState<string | null>(null)

    async function handleSubmit(event: Event) {
        event.preventDefault()
        try {
            setStatus(null)
            await onSubmit({
                teamNumber,
                alliance,
                auton,
                teleop,
                teamPenalties,
                opponentPenalties,
            })
            setStatus('Submitted for review')
        } catch (err) {
            console.error(err)
            setStatus('Could not submit')
        }
    }

    return (
        <section class="panel">
            <header class="panel-header">
                <div>
                    <p class="eyebrow">Scouting</p>
                    <h2>Record match data</h2>
                    <div class={`alliance-badge ${alliance}`}>
                        <span class={`alliance-dot ${alliance}`}></span>
                        Team {teamNumber}
                    </div>
                </div>
            </header>

            <form class="grid" onSubmit={handleSubmit}>
                <div class="phases-grid">
                    {(['auton', 'teleop'] as const).map((phase) => {
                        const data = phase === 'auton' ? auton : teleop
                        const setData = phase === 'auton' ? setAuton : setTeleop

                        return (
                            <div class="phase-section" key={phase}>
                                <h3 class="phase-title">{phase === 'auton' ? 'Autonomous' : 'Teleop'}</h3>

                                <label class="stack">
                                    <span class="label">Fuel scored</span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={data.fuelScored}
                                        onInput={(e) =>
                                            setData({ ...data, fuelScored: Number((e.target as HTMLInputElement).value) || 0 })
                                        }
                                        min="0"
                                        required
                                    />
                                </label>

                                <label class="stack">
                                    <span class="label">Fuel missed</span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={data.fuelMissed}
                                        onInput={(e) =>
                                            setData({ ...data, fuelMissed: Number((e.target as HTMLInputElement).value) || 0 })
                                        }
                                        min="0"
                                        required
                                    />
                                </label>

                                <label class="stack">
                                    <span class="label">Climb level</span>
                                    <select
                                        value={data.climbLevel}
                                        onChange={(e) => setData({ ...data, climbLevel: (e.target as HTMLSelectElement).value as any })}
                                    >
                                        <option value="none">None</option>
                                        <option value="low">Low</option>
                                        <option value="mid">Mid</option>
                                        <option value="high">High</option>
                                        <option value="traverse">Traverse</option>
                                    </select>
                                </label>
                            </div>
                        )
                    })}
                </div>

                <div class="penalties-section">
                    <label class="stack">
                        <span class="label">Team penalties</span>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={teamPenalties}
                            onInput={(e) => setTeamPenalties(Number((e.target as HTMLInputElement).value) || 0)}
                            min="0"
                        />
                    </label>

                    <label class="stack">
                        <span class="label">Opponent penalties</span>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={opponentPenalties}
                            onInput={(e) => setOpponentPenalties(Number((e.target as HTMLInputElement).value) || 0)}
                            min="0"
                        />
                    </label>
                </div>

                <div class="actions">
                    <button type="submit">Submit for review</button>
                    {status && <span class="muted">{status}</span>}
                </div>
            </form>
        </section>
    )
}
