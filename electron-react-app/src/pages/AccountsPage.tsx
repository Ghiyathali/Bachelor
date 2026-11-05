import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteAccount, listAccounts, updateAccount, type Account } from '../api/auth'
import { getErrorMessage } from '../api/client'
import { ROLES } from '../auth/permissions'
import { refreshSession } from '../auth/session'
import { useAuthStore } from '../stores/authStore'

function EditAccountDialog({ account, onClose, onSaved, onDeleted }: {
  account: Account
  onClose: () => void
  onSaved: (account: Account) => void
  onDeleted: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancelDelete = useRef<HTMLButtonElement>(null)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const [username, setUsername] = useState(account.username)
  const [email, setEmail] = useState(account.email)
  const [role, setRole] = useState(account.role)
  const [isActive, setIsActive] = useState(account.isActive)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const currentUsername = useAuthStore(state => state.user?.username)
  const self = currentUsername === account.username
  const changed = username !== account.username || email !== account.email || role !== account.role || isActive !== account.isActive
  const save = useMutation({
    mutationFn: () => updateAccount(account.id, { username, email, role, isActive }),
    onSuccess: async result => {
      if (self) await refreshSession()
      onSaved(result)
    },
  })
  const remove = useMutation({ mutationFn: () => deleteAccount(account.id), onSuccess: onDeleted })
  const busy = save.isPending || remove.isPending
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    if (confirmDelete) cancelDelete.current?.focus()
  }, [confirmDelete])
  function backToEditing() {
    setConfirmDelete(false)
    requestAnimationFrame(() => deleteButton.current?.focus())
  }
  const inputClass = 'mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-50'
  return (
    <dialog ref={dialog} aria-labelledby="account-dialog-title" aria-describedby="account-dialog-description" onCancel={event => {
      event.preventDefault()
      if (!busy) { if (confirmDelete) backToEditing(); else onClose() }
    }} className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-xl backdrop:bg-black/70">
      <div hidden={confirmDelete}>
        <h2 id={confirmDelete ? undefined : 'account-dialog-title'} className="text-2xl font-bold">Edit account</h2>
        <p id={confirmDelete ? undefined : 'account-dialog-description'} className="mt-2 break-words text-sm text-slate-400">Update account details for {account.username}.</p>
        <form onSubmit={event => { event.preventDefault(); save.mutate() }} className="mt-6 space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            <div>
              <label htmlFor="account-username" className="text-sm font-medium">Username</label>
              <input id="account-username" value={username} onChange={event => setUsername(event.target.value)} required minLength={3} maxLength={30} pattern="[^@\s]+" autoComplete="off" spellCheck={false} className={inputClass} />
            </div>
            <div>
              <label htmlFor="account-email" className="text-sm font-medium">Email</label>
              <input id="account-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={256} autoComplete="off" className={inputClass} />
            </div>
            <div>
              <label htmlFor="account-role" className="text-sm font-medium">Role</label>
              <select id="account-role" value={role} onChange={event => setRole(event.target.value)} disabled={self} className={inputClass}>
                {ROLES.map(name => <option key={name}>{name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} disabled={self} onChange={event => setIsActive(event.target.checked)} /> Active account</label>
          </fieldset>
          {self && <p className="text-sm text-slate-400">Another administrator must change your role, deactivate or delete your account.</p>}
          {save.error && <p role="alert" className="text-sm text-rose-300">{getErrorMessage(save.error)}</p>}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-5">
            <button ref={deleteButton} type="button" disabled={self || busy} onClick={() => { remove.reset(); setConfirmDelete(true) }} className="mr-auto rounded border border-rose-800 px-3 py-2 text-sm text-rose-300 hover:bg-rose-950 disabled:opacity-40">Delete account</button>
            <button type="button" disabled={busy} onClick={onClose} className="rounded border border-slate-600 px-4 py-2 text-sm disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={busy || !changed} className="rounded bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-40">{save.isPending ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
      {confirmDelete && <div>
        <h2 id="account-dialog-title" className="text-xl font-bold">Delete account permanently?</h2>
        <p id="account-dialog-description" className="mt-3 break-words text-slate-300">Delete <strong>{account.username}</strong> ({account.email})? This cannot be undone. Their existing sessions will lose access immediately.</p>
        <p className="mt-3 text-sm text-slate-400">To keep the account and block access, cancel and uncheck Active account instead.</p>
        {remove.error && <p role="alert" className="mt-4 text-rose-300">{getErrorMessage(remove.error)}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button ref={cancelDelete} type="button" disabled={busy} onClick={backToEditing} className="rounded border border-slate-600 px-4 py-2 disabled:opacity-40">Cancel</button>
          <button type="button" disabled={busy} onClick={() => remove.mutate()} className="rounded bg-rose-700 px-4 py-2 font-medium hover:bg-rose-600 disabled:opacity-40">{remove.isPending ? 'Deleting…' : 'Delete permanently'}</button>
        </div>
      </div>}
    </dialog>
  )
}

export default function AccountsPage() {
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Account | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  function finish(message: string) {
    setNotice(message)
    setEditing(null)
    void queryClient.invalidateQueries({ queryKey: ['accounts'] })
  }
  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Manage accounts</h1>
        <Link to="/register" className="rounded bg-sky-600 px-4 py-2">Create account</Link>
      </div>
      <p className="mt-3 text-slate-400">Manage staff accounts and access. Choose Edit to change an account.</p>
      {notice && <p role="status" className="mt-4 text-emerald-300">{notice}</p>}
      {accounts.isLoading && <p className="mt-6">Loading accounts…</p>}
      {accounts.error && <p role="alert" className="mt-6 text-rose-300">{getErrorMessage(accounts.error)}</p>}
      {accounts.data && <div className="mt-6 overflow-x-auto"><table className="w-full text-left">
        <thead><tr><th className="p-3">Account</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead>
        <tbody>{accounts.data.map(account => <tr key={account.id} className="border-t border-slate-800">
          <td className="p-3">{account.username}<span className="block text-sm text-slate-400">{account.email}</span></td>
          <td className="p-3">{account.role}</td>
          <td className="p-3"><span className={account.isActive ? 'text-emerald-300' : 'text-slate-400'}>{account.isActive ? 'Active' : 'Inactive'}</span></td>
          <td className="p-3"><button type="button" aria-label={`Edit ${account.username}`} onClick={() => { setNotice(null); setEditing(account) }} className="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800">Edit</button></td>
        </tr>)}</tbody>
      </table></div>}
      {editing && <EditAccountDialog key={editing.id} account={editing} onClose={() => setEditing(null)} onSaved={account => finish(`Account ${account.username} saved.`)} onDeleted={() => finish(`Account ${editing.username} deleted.`)} />}
    </section>
  )
}
