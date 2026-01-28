import { useState } from 'preact/hooks'

export function useMessage() {
    const [message, setMessage] = useState<string | null>(null)

    const showMessage = (msg: string) => setMessage(msg)
    const clearMessage = () => setMessage(null)

    return { message, showMessage, clearMessage }
}

export function useLoadingState(initialState = false) {
    const [loading, setLoading] = useState(initialState)

    return { loading, setLoading }
}

export function useAsyncAction() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const execute = async <T,>(
        action: () => Promise<T>,
        successMsg?: string,
        errorMsg?: string,
    ): Promise<T | undefined> => {
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const result = await action()
            if (successMsg) {
                setSuccess(successMsg)
            }
            return result
        } catch (err) {
            const message = errorMsg || (err as any)?.message || 'An error occurred'
            setError(message)
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const reset = () => {
        setLoading(false)
        setError(null)
        setSuccess(null)
    }

    return { loading, error, success, execute, reset }
}
