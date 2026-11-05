import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listAccounts, updateAccount, type Account } from '../api/auth'
import { getErrorMessage } from '../api/client'
import { ROLES } from '../auth/permissions'
import { useAuthStore } from '../stores/authStore'

function AccountRow({ account }: { account: Account }) {
  const [role, setRole] = useState(account.role)
  const [isActive, setIsActive] = useState(account.isActive)
  const queryClient = useQueryClient()
  const username = useAuthStore(state => state.user?.username)
  const self = username === account.username
  const save = useMutation({
    mutationFn: () => updateAccount(account.id, role, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })
  return (
    <tr className="border-t border-slate-800">
      <td className="p-3">{account.username}<span className="block text-sm text-slate-400">{account.email}</span></td>
      <td className="p-3">
        <select aria-label={`Role for ${account.username}`} value={role} onChange={e => setRole(e.target.value)} disabled={self || save.isPending} className="rounded border border-slate-700 bg-slate-900 p-2">
          {ROLES.map(name => <option key={name}>{name}</option>)}
        </select>
      </td>
      <td className="p-3"><label><input type="checkbox" checked={isActive} disabled={self || save.isPending} onChange={e => setIsActive(e.target.checked)} /> Active</label></td>
      <td className="p-3">
        <button type="button" disabled={self || save.isPending || (role === account.role && isActive === account.isActive)} onClick={() => save.mutate()} className="rounded bg-sky-600 px-3 py-2 disabled:opacity-40">{save.isPending ? 'Saving…' : 'Save'}</button>
        {save.error && <p role="alert" className="mt-2 text-rose-300">{getErrorMessage(save.error)}</p>}
        {save.isSuccess && <p role="status" className="mt-2 text-emerald-300">Saved</p>}
      </td>
    </tr>
  )
}

export default function AccountsPage() {
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Manage accounts</h1>
        <Link to="/register" className="rounded bg-sky-600 px-4 py-2">Create account</Link>
      </div>
      <p className="mt-3 text-slate-400">Role and status changes apply to existing sessions immediately. Another administrator must change your own access.</p>
      {accounts.isLoading && <p className="mt-6">Loading accounts…</p>}
      {accounts.error && <p role="alert" className="mt-6 text-rose-300">{getErrorMessage(accounts.error)}</p>}
      {accounts.data && <div className="mt-6 overflow-x-auto"><table className="w-full text-left">
        <thead><tr><th className="p-3">Account</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead>
        <tbody>{accounts.data.map(account => <AccountRow key={account.id + account.role + account.isActive} account={account} />)}</tbody>
      </table></div>}
    </section>
  )
}
