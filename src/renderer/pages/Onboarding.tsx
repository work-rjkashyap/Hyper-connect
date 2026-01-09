import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { useStore } from '../store/useStore'
import { Monitor } from 'lucide-react'
import { ThemeToggle } from '../components/ui/theme-toggle'

export const Onboarding: React.FC = () => {
    const [name, setName] = useState('')
    const setOnboardingComplete = useStore((state) => state.setOnboardingComplete)
    const setLocalDevice = useStore((state) => state.setLocalDevice)

    const handleContinue = async () => {
        if (!name.trim()) return

        try {
            const deviceInfo = await window.api.updateDisplayName(name)
            setLocalDevice(deviceInfo)
            setOnboardingComplete(true)
        } catch (e) {
            console.error('Failed to update name:', e)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4 relative overflow-hidden">
            {/* Background blobs for premium feel */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />

            <div className="absolute top-6 right-6">
                <ThemeToggle />
            </div>

            <Card className="w-full max-w-md border border-border/50 shadow-2xl glass animate-in zoom-in-95 duration-500">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-20 h-20 bg-linear-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center shadow-inner">
                        <Monitor className="w-10 h-10 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-3xl font-bold tracking-tight bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Hyper-connect
                        </CardTitle>
                        <CardDescription className="text-base">
                            Set a display name for this device so others can find you on the network.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-muted-foreground ml-1">
                            Display Name
                        </label>
                        <Input
                            placeholder="e.g. My MacBook Pro"
                            value={name}
                            onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                            onChange={(e) => setName(e.target.value)}
                            className="h-14 text-lg bg-background/50 border-border/50 focus:border-primary/50 transition-all rounded-xl"
                        />
                    </div>
                </CardContent>
                <CardFooter className="pb-8">
                    <Button
                        className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        disabled={!name.trim()}
                        onClick={handleContinue}
                    >
                        Get Started
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
