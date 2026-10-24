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
    <section className="mx-auto max-w-sm">
      <h1 className="text-3xl font-bold text-white">Log in</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-slate-300">
            Email or username
          </label>
          <input
            id="identifier"
            autoComplete="username"
            {...register('identifier')}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
          {errors.identifier && <p className="mt-1 text-sm text-rose-300">{errors.identifier.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
          {errors.password && <p className="mt-1 text-sm text-rose-300">{errors.password.message}</p>}
        </div>

        {serverError && <p className="rounded-md bg-rose-950 px-3 py-2 text-sm text-rose-200">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      {/* #52: accounts are created by an Admin, there is no self-registration */}
      <p className="mt-6 text-sm text-slate-400">
        No account yet? Ask an administrator to create one for you.
      </p>
    </section>
  )
}
