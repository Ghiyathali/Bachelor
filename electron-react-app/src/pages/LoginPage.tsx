import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { login } from '../api/auth'
import { getErrorMessage } from '../api/client'
import { useAuthStore } from '../stores/authStore'

// Form rules (checked in the browser before anything is sent)
const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username.'),
  password: z.string().min(1, 'Enter your password.'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginForm) {
    setServerError(null)
    try {
      const result = await login(values)
      // Put the wristband in the locker
      setSession(result.token, result.expiresAt, {
        username: result.username,
        email: result.email,
        role: result.role,
      })
      await navigate({ to: '/' })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  return (
    <section className="mx-auto mt-4 max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card sm:mt-12 sm:p-10">
      <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-ink">Pangaea Analytics</p>
      <h1 className="text-3xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Log in to your Pangaea workspace.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-body">
            Email or username
          </label>
          <input
            id="identifier"
            autoComplete="username"
            {...register('identifier')}
            className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
          {errors.identifier && <p className="mt-1 text-sm text-danger">{errors.identifier.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-body">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
          {errors.password && <p className="mt-1 text-sm text-danger">{errors.password.message}</p>}
        </div>

        {serverError && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      {/* #52: accounts are created by an Admin, there is no self-registration */}
      <p className="mt-6 border-t border-line pt-5 text-xs leading-5 text-helper">
        No account yet? Ask an administrator to create one for you.
      </p>
    </section>
  )
}
