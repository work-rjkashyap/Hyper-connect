import { useToast } from '@/hooks/use-toast'
import { Toast } from './toast'

export function Toaster() {
    const { toasts } = useToast()

    return (
        <div
            className="fixed z-100 flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col sm:max-w-[420px] gap-2 pointer-events-none"
            style={{
                top: 'calc(1rem + var(--safe-area-top, 0px))',
                paddingBottom: 'calc(1rem + var(--safe-area-bottom, 0px))'
            }}
        >
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    open={toast.open}
                    onOpenChange={toast.onOpenChange}
                    title={toast.title}
                    description={toast.description}
                    variant={toast.variant}
                    action={toast.action}
                />
            ))}
        </div>
    )
}
