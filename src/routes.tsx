import { createHashRouter, Navigate } from 'react-router-dom';
import RootLayout from './components/layout/RootLayout';
import EmptyStatePage from './pages/EmptyStatePage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import DiscoveryPage from './pages/DiscoveryPage';
import OnboardingPage from './pages/OnboardingPage';
import { useAppStore } from './store';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const isOnboarded = useAppStore((state) => state.isOnboarded);
    if (!isOnboarded) {
        return <Navigate to="/onboarding" replace />;
    }
    return <>{children}</>;
};

// Onboarding Guard Component
const OnboardingGuard = ({ children }: { children: React.ReactNode }) => {
    const isOnboarded = useAppStore((state) => state.isOnboarded);
    if (isOnboarded) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
};

export const router = createHashRouter([
    {
        path: '/onboarding',
        element: (
            <OnboardingGuard>
                <OnboardingPage />
            </OnboardingGuard>
        ),
    },
    {
        path: '/',
        element: (
            <ProtectedRoute>
                <RootLayout />
            </ProtectedRoute>
        ),
        children: [
            {
                index: true,
                element: <EmptyStatePage />,
            },
            {
                path: 'discovery',
                element: <DiscoveryPage />,
            },
            {
                path: 'chat/:deviceId',
                element: <ChatPage />,
            },
            {
                path: 'settings',
                element: <SettingsPage />,
            },
        ],
    },
]);
