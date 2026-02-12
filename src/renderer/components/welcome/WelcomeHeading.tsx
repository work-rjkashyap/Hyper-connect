import React from 'react'

interface WelcomeHeadingProps {
  title?: string
  description?: string
}

export const WelcomeHeading: React.FC<WelcomeHeadingProps> = ({
  title = 'Welcome to Hyper Connect',
  description = 'Share files and messages instantly across devices on your local network'
}) => {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}
