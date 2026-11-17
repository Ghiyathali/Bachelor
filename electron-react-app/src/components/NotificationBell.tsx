import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../api/client'
import { approvePasswordRequest, declinePasswordRequest, listPasswordRequests, type PasswordRequest } from '../api/passwordRequests'
import Icon from './Icon'

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

function RequestRow({ request }: { request: PasswordRequest }) {
  const queryClient = useQueryClient()
  const decide = useMutation({
    mutationFn: (approve: boolean) => (approve ? approvePasswordRequest(request.id) : declinePasswordRequest(request.id)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['password-requests'] }),
  })
  return (
    <li className="flex gap-3 border-t border-line px-5 py-4 first:border-t-0">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
        <Icon name="lock" className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          <span className="font-semibold">{request.username}</span> wants to reset their password
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">{request.email} · {timeAgo(request.requestedAt)}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={decide.isPending} onClick={() => decide.mutate(true)}
            className="bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            Approve
          </button>
          <button type="button" disabled={decide.isPending} onClick={() => decide.mutate(false)}
            className="border border-line px-3 py-1.5 text-xs font-semibold text-body hover:bg-hover disabled:opacity-50">
            Decline
          </button>
        </div>
        {decide.error && <p role="alert" className="mt-2 text-xs text-danger">{getErrorMessage(decide.error)}</p>}
      </div>
    </li>
  )
}

// Admin only, top right of every page: "forgot password" requests waiting for approval.
// Checks for new ones every 30 seconds. Built so more kinds of notifications can be added later.
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const requests = useQuery({ queryKey: ['password-requests'], queryFn: listPasswordRequests, refetchInterval: 30_000 })
  const count = requests.data?.length ?? 0

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => { if (!area.current?.contains(event.target as Node)) setOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [open])

  return (
    <div ref={area} className="relative">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="dialog"
        aria-label={count > 0 ? `Notifications: ${count} waiting` : 'Notifications'}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full! border bg-surface shadow-card hover:bg-hover ${open ? 'border-brand text-brand-ink' : 'border-line text-body'}`}>
        <Icon name="bell" className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-attention px-1 text-[11px] font-bold text-white ring-2 ring-canvas">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications"
          className="absolute right-0 top-full z-40 mt-3 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-semibold text-ink">Notifications</h2>
            {count > 0 && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink">{count} waiting</span>}
          </div>
          <div className="border-t border-line">
            {requests.error ? (
              <p className="px-5 py-6 text-sm text-danger">{getErrorMessage(requests.error)}</p>
            ) : count === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-hover text-muted">
                  <Icon name="bell" className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-medium text-ink">You're all caught up</p>
                <p className="mt-1 text-xs text-muted">Password reset requests will show up here.</p>
              </div>
            ) : (
              <ul className="max-h-[22rem] overflow-y-auto">{requests.data!.map(r => <RequestRow key={r.id} request={r} />)}</ul>
            )}
          </div>
          {count > 0 && (
            <p className="border-t border-line bg-canvas px-5 py-3 text-xs text-muted">Only approve requests you know the person made.</p>
          )}
        </div>
      )}
    </div>
  )
}
