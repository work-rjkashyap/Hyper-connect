import React from 'react'

interface GetStartedPromptProps {
  message?: string
}

export const GetStartedPrompt: React.FC<GetStartedPromptProps> = ({
  message = 'Select a device from the sidebar to start sharing'
}) => {
  return (
    <div className="pt-6">
      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-sm">{message}</p>
      </div>
    </div>
  )
}
