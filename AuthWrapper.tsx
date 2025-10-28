import React from 'react';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/AuthPage';
import App from './App';

const AuthWrapper: React.FC = () => {
    const { currentUser, login, signup, logout, loading, changePassword } = useAuth();

    if (loading) {
        // Simple loading screen to prevent flicker while checking session
        return <div className="min-h-screen bg-slate-950"></div>;
    }

    if (!currentUser) {
        return <AuthPage onLogin={login} onSignup={signup} />;
    }

    return <App currentUser={currentUser} onLogout={logout} onChangePassword={changePassword} />;
};

export default AuthWrapper;