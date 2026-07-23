import { redirect } from 'next/navigation'

export default async function PartidosPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  redirect(`/p/${poolId}/jornadas`)
}
