import { useState } from 'react'
import type { FormEvent } from 'react'
import { getErrorMessage } from '../api/client'
import { requestPasswordReset } from '../api/passwordRequests'
import { MAX_PASSWORD, MIN_PASSWORD, passwordProblem } from '../auth/passwordRules'

const inputClass = 'mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink'

// "Forgot password?" on the login page. The new password only works after an Admin approves
// the request, so nobody can take over someone else's account just by knowing their email.
export default function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [identifier, setIdentifier] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const problem = identifier.trim() === '' ? 'Enter your email or username.'
    : newPassword === '' ? `The new password must be at least ${MIN_PASSWORD} characters.`
    : passwordProblem({ newPassword, confirm, current: '', self: false })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setTried(true)
    setServerError(null)
    if (problem) return
    setBusy(true)
    try {
      setSent(await requestPasswordReset(identifier.trim(), newPassword))
    } catch (error) {
      setServerError(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto mt-4 max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card sm:mt-12 sm:p-10">
      <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-ink">Pangaea Analytics</p>
      <h1 className="text-3xl font-semibold text-ink">Forgot password</h1>
      {sent ? (
        <>
          <p role="status" className="mt-4 rounded-md bg-hover px-3 py-3 text-sm leading-6 text-body">{sent}</p>
          <p className="mt-3 text-sm text-muted">Until then, your old password still works.</p>
          <button type="button" onClick={onBack} className="mt-8 w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
            Back to log in
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-muted">Choose a new password. An administrator has to approve it before you can use it.</p>
          <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="forgot-identifier" className="block text-sm font-medium text-body">Email or username</label>
              <input id="forgot-identifier" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="forgot-new" className="block text-sm font-medium text-body">New password</label>
              <input id="forgot-new" type="password" autoComplete="new-password" maxLength={MAX_PASSWORD} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="forgot-confirm" className="block text-sm font-medium text-body">Confirm new password</label>
              <input id="forgot-confirm" type="password" autoComplete="new-password" maxLength={MAX_PASSWORD} value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} />
            </div>
            {tried && problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
            {serverError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{serverError}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50">
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </form>
          <button type="button" onClick={onBack} className="mt-6 text-sm font-medium text-brand-ink hover:underline">Back to log in</button>
        </>
      )}
    </section>
  )
}
