import { Inter, Lora } from 'next/font/google'
import { Provider } from '@/components/provider'
import './global.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans'
})

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-serif'
})

export default function Layout({ children }: LayoutProps<'/'>): React.ReactElement {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
