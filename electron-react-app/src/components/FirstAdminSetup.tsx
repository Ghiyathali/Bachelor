import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { getErrorMessage } from '../api/client'
import { createFirstAdmin } from '../api/setup'
import { type FirstAdminFields, firstAdminProblems } from '../auth/passwordRules'
import { useAuthStore } from '../stores/authStore'

const inputClass = 'mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink'

// Shown on the login page instead of the login form when the database has no Admin yet
// (the first start on a new database). The person who sets up the app creates the first
// Admin here, is logged in straight away, and can then create the other accounts.
export default function FirstAdminSetup({ onAdminExists }: { onAdminExists: () => void }) {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)
  const [fields, setFields] = useState<FirstAdminFields>({ username: '', email: '', password: '', confirm: '' })
  const [triedSubmit, setTriedSubmit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const problems = firstAdminProblems(fields)
  const show = (field: keyof FirstAdminFields) => (triedSubmit ? problems[field] : undefined)

  function update(field: keyof FirstAdminFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }))
    setServerError(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setTriedSubmit(true)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    try {
      const result = await createFirstAdmin({ username: fields.username.trim(), email: fields.email.trim(), password: fields.password })
      setSession(result.token, result.expiresAt, { username: result.username, email: result.email, role: result.role })
      await navigate({ to: '/' })
    } catch (error) {
      // Someone else finished the setup first: show the normal login instead.
      if (isAxiosError(error) && error.response?.status === 409) onAdminExists()
      else setServerError(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const field = (name: keyof FirstAdminFields, label: string, type: string, autoComplete: string) => (
    <div>
      <label htmlFor={`setup-${name}`} className="block text-sm font-medium text-body">{label}</label>
      <input
        id={`setup-${name}`}
        type={type}
        autoComplete={autoComplete}
        value={fields[name]}
        onChange={(e) => update(name, e.target.value)}
        aria-invalid={Boolean(show(name))}
        className={inputClass}
      />
      {show(name) && <p className="mt-1 text-sm text-danger">{show(name)}</p>}
    </div>
  )

  return (
    <section className="mx-auto mt-4 max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card sm:mt-12 sm:p-10">
      <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-ink">Pangaea Analytics</p>
      <h1 className="text-3xl font-semibold text-ink">Set up Pangaea</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Create the first administrator account. You can add more accounts and roles afterwards.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-5" noValidate>
        {field('username', 'Username', 'text', 'username')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password', 'password', 'new-password')}
        {field('confirm', 'Confirm password', 'password', 'new-password')}

        {serverError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{serverError}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? 'Creating account…' : 'Create admin account'}
        </button>
      </form>

      <p className="mt-6 border-t border-line pt-5 text-xs leading-5 text-helper">
        This only appears once, while there is no administrator yet.
      </p>
    </section>
  )
}
