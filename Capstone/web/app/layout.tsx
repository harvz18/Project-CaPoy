import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const inter = localFont({
  variable: '--font-inter',
  display: 'swap',
  src: [
    { path: '../node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf', weight: '400' },
    { path: '../node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf', weight: '500' },
    { path: '../node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf', weight: '600' },
    { path: '../node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf', weight: '700' },
  ],
})

export const metadata: Metadata = {
  title: 'MULTIVENT Operations',
  description: 'Administration and platform governance for MULTIVENT.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  )
}
