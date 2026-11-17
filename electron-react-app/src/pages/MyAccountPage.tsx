import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { changePassword, updateAccount } from '../api/auth'
import { api, getErrorMessage } from '../api/client'
import { MAX_PASSWORD, MIN_PASSWORD, passwordProblem } from '../auth/passwordRules'
import { refreshSession } from '../auth/session'
import { useAuthStore } from '../stores/authStore'

const inputClass = 'mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-ink'

// Standard User (FR-12 updated): edit only your own username, email and password.
// The role and "active" can only be changed by an administrator.
export default function MyAccountPage() {
  const user = useAuthStore(state => state.user)
  const me = useQuery({ queryKey: ['me'], queryFn: async () => (await api.get<{ id: string }>('/api/auth/me')).data })
  const id = Number(me.data?.id)

  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [detailsSaved, setDetailsSaved] = useState(false)
  const [current, setCurrent] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [triedPassword, setTriedPassword] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const problem = passwordProblem({ newPassword, confirm, current, self: true }) ??
    (newPassword === '' ? `The new password must be at least ${MIN_PASSWORD} characters.` : null)

  const saveDetails = useMutation({
    mutationFn: () => updateAccount(id, { username, email, role: user!.role, isActive: true }),
    onSuccess: async () => { await refreshSession(); setDetailsSaved(true) },
  })
  const savePassword = useMutation({
    mutationFn: () => changePassword(id, { newPassword, currentPassword: current }),
    onSuccess: ({ token, expiresAt }) => {
      // Older logins stop working after a password change; this keeps you logged in.
      const state = useAuthStore.getState()
      if (token && expiresAt && state.user) state.setSession(token, expiresAt, state.user)
      setPasswordSaved(true)
      setCurrent(''); setNewPassword(''); setConfirm(''); setTriedPassword(false)
    },
  })

  function submitDetails(event: FormEvent) {
    event.preventDefault()
    setDetailsSaved(false)
    saveDetails.mutate()
  }
  function submitPassword(event: FormEvent) {
    event.preventDefault()
    setTriedPassword(true)
    setPasswordSaved(false)
    if (problem === null) savePassword.mutate()
  }

  const detailsChanged = username !== user?.username || email !== user?.email
  return (
    <section className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-ink">Account</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink">My account</h1>
      <p className="mt-3 text-body">Change your username, email or password.</p>

      <form onSubmit={submitDetails} className="mt-8 space-y-4 rounded-xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink">Details</h2>
        <div>
          <label htmlFor="my-username" className="text-sm font-medium text-body">Username</label>
          <input id="my-username" value={username} onChange={e => { setUsername(e.target.value); setDetailsSaved(false) }} autoComplete="username" className={inputClass} />
        </div>
        <div>
          <label htmlFor="my-email" className="text-sm font-medium text-body">Email</label>
          <input id="my-email" type="email" value={email} onChange={e => { setEmail(e.target.value); setDetailsSaved(false) }} autoComplete="email" className={inputClass} />
        </div>
        <p className="text-sm text-muted">Role: <span className="font-medium text-ink">{user?.role}</span> · only an administrator can change it.</p>
        {saveDetails.error && <p role="alert" className="text-sm text-danger">{getErrorMessage(saveDetails.error)}</p>}
        {detailsSaved && <p role="status" className="text-sm text-success">Details saved.</p>}
        <button type="submit" disabled={!detailsChanged || saveDetails.isPending || !me.data}
          className="bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40">
          {saveDetails.isPending ? 'Saving…' : 'Save details'}
        </button>
      </form>

      <form onSubmit={submitPassword} className="mt-6 space-y-4 rounded-xl border border-line bg-surface p-6 shadow-card">
        <div>
          <h2 className="text-lg font-semibold text-ink">Change your password</h2>
          <p className="mt-1 text-xs text-helper">{MIN_PASSWORD} to {MAX_PASSWORD} characters.</p>
        </div>
        <div>
          <label htmlFor="my-current" className="text-sm font-medium text-body">Current password</label>
          <input id="my-current" type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" className={inputClass} />
        </div>
        <div>
          <label htmlFor="my-new" className="text-sm font-medium text-body">New password</label>
          <input id="my-new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} maxLength={MAX_PASSWORD} autoComplete="new-password" className={inputClass} />
        </div>
        <div>
          <label htmlFor="my-confirm" className="text-sm font-medium text-body">Confirm new password</label>
          <input id="my-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} maxLength={MAX_PASSWORD} autoComplete="new-password" className={inputClass} />
        </div>
        {triedPassword && problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
        {savePassword.error && <p role="alert" className="text-sm text-danger">{getErrorMessage(savePassword.error)}</p>}
        {passwordSaved && <p role="status" className="text-sm text-success">Password changed.</p>}
        <button type="submit" disabled={savePassword.isPending || !me.data}
          className="bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40">
          {savePassword.isPending ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </section>
  )
}
