import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function GlobalAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: isPlatformAdmin } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!isPlatformAdmin) redirect('/pools')

  redirect('/pools')
}
