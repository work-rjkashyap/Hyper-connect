import React from 'react'
import { Zap } from 'lucide-react'

export const WelcomeIcon: React.FC = () => {
  return (
    <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto">
      <Zap className="w-10 h-10 text-blue-600 dark:text-blue-400" />
    </div>
  )
}
