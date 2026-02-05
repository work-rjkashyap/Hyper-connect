import React, { useEffect, useCallback } from 'react'
import Moon from 'lucide-react/dist/esm/icons/moon'
import Sun from 'lucide-react/dist/esm/icons/sun'
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

  const handleToggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggleTheme}
      className="w-9 h-9 rounded-full"
    >
      {theme === 'light' ? (
        <Sun className="h-4 w-4 text-warning" />
      ) : (
        <Moon className="h-4 w-4 text-info" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
