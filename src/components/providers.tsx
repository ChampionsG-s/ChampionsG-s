'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30s
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: {
            background: 'linear-gradient(155deg, rgba(29,47,83,0.95), rgba(10,15,30,0.98) 45%, rgba(7,11,22,0.99) 100%)',
            border: '1px solid rgba(212,160,23,0.3)',
            color: '#f5f0e6',
          },
        }}
      />
    </QueryClientProvider>
  )
}
