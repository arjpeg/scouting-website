import type { ComponentChildren } from 'preact'

export function PanelHeader({
    eyebrow,
    title,
    description,
    action,
}: {
    eyebrow: string
    title: string
    description: string
    action?: ComponentChildren
}) {
    return (
        <header class="panel-header">
            <div>
                <p class="eyebrow">{eyebrow}</p>
                <h2>{title}</h2>
                <p class="muted">{description}</p>
            </div>
            {action}
        </header>
    )
}

export function MessageToast({ message }: { message: string | null }) {
    if (!message) return null
    return <p class="toast">{message}</p>
}

export function LoadingState({ text = 'Loading…' }: { text?: string }) {
    return <p class="muted">{text}</p>
}

export function EmptyState({ text }: { text: string }) {
    return <p>{text}</p>
}
