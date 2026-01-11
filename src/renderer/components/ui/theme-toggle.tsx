import React, { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@renderer/components/ui/button'
import { useStore } from '@renderer/store/useStore'

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useStore(
    useShallow((state) => ({
      theme: state.theme,
      setTheme: state.setTheme
    }))
  )

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="w-9 h-9 rounded-full"
    >
      {theme === 'light' ? (
        <Sun className="h-4 w-4 text-orange-500" />
      ) : (
        <Moon className="h-4 w-4 text-blue-500" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
