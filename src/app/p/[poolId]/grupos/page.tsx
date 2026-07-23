import { redirect } from 'next/navigation'

export default async function GruposPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  redirect(`/p/${poolId}/clasificacion`)
}
