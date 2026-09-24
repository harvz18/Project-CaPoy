import { notFound } from 'next/navigation'
import { OperationsScreen } from '@/components/screens/operations-screen'
import type { SectionKey } from '@/lib/types'

const sections: SectionKey[] = ['users', 'providers', 'services', 'bookings', 'payments', 'reviews', 'audit', 'settings']

export function generateStaticParams() {
  return sections.map((section) => ({ section }))
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (!sections.includes(section as SectionKey)) notFound()
  return <OperationsScreen section={section as Exclude<SectionKey, 'overview'>} />
}
