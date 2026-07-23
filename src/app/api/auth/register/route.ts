import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { username, email, password } = await request.json()

  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    return NextResponse.json({ error: 'Usuario y contraseña son obligatorios.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const trimmedUsername = username.trim()

  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('username', trimmedUsername)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Ese nombre ya está en uso.' }, { status: 409 })
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: trimmedUsername },
  })

  if (error) {
    const message = error.message.includes('already been registered')
      ? 'Ese nombre ya está en uso.'
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
