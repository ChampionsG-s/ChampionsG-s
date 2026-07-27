import { redirect } from 'next/navigation'

export default async function VerPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  redirect(`/p/${poolId}/ranking`)
}
