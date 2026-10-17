import { useCallback, useRef } from "react"
import { toast } from "@workspace/ui/components/toast"
import { explorerTxUrl } from "@/app/config/network"

// #732: Explicit lifecycle events for transaction feedback without English message matching
export type TxFeedbackEvent =
  | { type: "signing"; message: string }
  | { type: "signed" }
  | { type: "submitting"; message: string }
  | { type: "submitted"; hash: string; description?: string }
  | { type: "confirming" }
  | { type: "confirmed"; hash: string }
  | { type: "ordering"; message: string }
  | { type: "order_settled"; message: string; description?: string }
  | { type: "error"; message: string }
  | { type: "unknown_outcome"; hash?: string }

// #732: Each attempt gets its own stable toast ID; concurrent transactions don't interfere
type TxAttempt = {
  readonly attemptId: string
  readonly createdAt: number
  toastId: string | null
  status: "pending" | "signed" | "submitted" | "confirmed" | "settled" | "failed"
  hash: string | null
}

export function useTxFeedback() {
  const attemptRef = useRef<TxAttempt | null>(null)

  const createAttempt = useCallback((attemptId: string): TxAttempt => {
    const attempt: TxAttempt = {
      attemptId,
      createdAt: Date.now(),
      toastId: null,
      status: "pending",
      hash: null,
    }
    attemptRef.current = attempt
    return attempt
  }, [])

  const handleEvent = useCallback((event: TxFeedbackEvent) => {
    const attempt = attemptRef.current
    if (!attempt) return

    switch (event.type) {
      case "signing":
        attempt.toastId = toast.show({
          id: attempt.attemptId,
          message: event.message,
          variant: "transaction-progress",
          duration: 0,
          persistent: true,
        })
        break

      case "signed":
        // Signing complete, ready for submission
        break

      case "submitting":
        if (attempt.toastId) {
          toast.show({
            id: attempt.attemptId,
            message: event.message,
            variant: "transaction-progress",
            duration: 0,
            persistent: true,
          })
        }
        break

      case "submitted":
        attempt.hash = event.hash
        attempt.status = "submitted"
        if (attempt.toastId) {
          toast.show({
            id: attempt.attemptId,
            message: "Confirming on ledger...",
            variant: "transaction-progress",
            duration: 0,
            persistent: true,
            description: event.description,
          })
        }
        break

      case "confirming":
        // Ledger confirmation in progress
        break

      case "confirmed":
        attempt.hash = event.hash
        attempt.status = "confirmed"
        if (attempt.toastId) {
          toast.show({
            id: attempt.attemptId,
            message: "Transaction confirmed",
            variant: "transaction-progress",
            duration: 0,
            persistent: true,
          })
        }
        break

      case "ordering":
        // For order settlement flow
        if (attempt.toastId) {
          toast.show({
            id: attempt.attemptId,
            message: event.message,
            variant: "transaction-progress",
            duration: 0,
            persistent: true,
          })
        }
        break

      case "order_settled":
        attempt.status = "settled"
        if (attempt.toastId) {
          const explorerLink = attempt.hash
            ? `<a href="${explorerTxUrl(attempt.hash)}" target="_blank" rel="noreferrer" class="text-xs text-primary hover:underline">View transaction →</a>`
            : null

          toast.show({
            id: attempt.attemptId,
            message: event.message,
            variant: "success",
            duration: 4000,
            description: event.description || explorerLink,
          })
        }
        break

      case "error":
        attempt.status = "failed"
        if (attempt.toastId) {
          toast.error(event.message, { id: attempt.attemptId })
        } else {
          toast.error(event.message)
        }
        break

      case "unknown_outcome":
        // #733: Unknown submission outcome — status should be looked up by hash if available
        attempt.status = "submitted"
        if (attempt.toastId) {
          toast.show({
            id: attempt.attemptId,
            message: "Submission status unknown",
            description: "Checking ledger...",
            variant: "transaction-progress",
            duration: 0,
            persistent: true,
          })
        }
        break
    }
  }, [])

  const getCurrentAttempt = useCallback((): TxAttempt | null => {
    return attemptRef.current
  }, [])

  const clearAttempt = useCallback(() => {
    attemptRef.current = null
  }, [])

  return {
    createAttempt,
    handleEvent,
    getCurrentAttempt,
    clearAttempt,
  }
}
