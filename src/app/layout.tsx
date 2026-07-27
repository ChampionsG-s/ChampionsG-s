import type { Metadata, Viewport } from 'next'
import { Inter, Bebas_Neue, Playfair_Display } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'Champions G\'s',
  description: 'La quiniela de la Liga española de la próxima temporada',
  icons: { icon: '/logo.jpg', apple: '/logo.jpg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#070b16',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${bebas.variable} ${playfair.variable}`}>
      <body className="bg-background text-cream antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}