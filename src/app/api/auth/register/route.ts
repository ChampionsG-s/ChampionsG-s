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

  const { data: created, error } = await admin.auth.admin.createUser({
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

  // Modo pool unico: todo usuario nuevo pide entrar a ChampionsG's y queda
  // "pending" hasta que un admin lo acepte desde el panel de Miembros. Se
  // hace con el cliente admin (bypassa RLS) porque un usuario recien
  // creado todavia no es miembro y no puede ni leer la fila de pools.
  const { data: pool } = await admin
    .from('pools')
    .select('id')
    .or("name.eq.ChampionsG's,name.eq.ChampionsG´s")
    .limit(1)
    .maybeSingle()

  if (pool && created.user) {
    await admin
      .from('pool_members')
      .insert({ pool_id: pool.id, user_id: created.user.id, role: 'member', status: 'pending' })
  }

  return NextResponse.json({ ok: true })
}
