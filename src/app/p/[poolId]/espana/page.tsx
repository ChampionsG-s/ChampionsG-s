import { redirect } from 'next/navigation'

export default async function EspanaPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  redirect(`/p/${poolId}/jornadas`)
}
