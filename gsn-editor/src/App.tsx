import { useEffect, useState } from 'react';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Canvas } from './components/Canvas/Canvas';
import { LoginForm } from './components/Auth/LoginForm';
import { RegisterForm } from './components/Auth/RegisterForm';
import { useAuthStore } from './stores/authStore';

function App() {
  const { isAuthenticated, checkAuth, logout, user, isLoading } = useAuthStore();
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    console.log('App mounted, checking auth...');
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  console.log('App render:', { isAuthenticated, isLoading, user });

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        color: '#666',
      }}>
        読み込み中...
      </div>
    );
  }

  // Show auth forms if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        overflow: 'auto',
      }}>
        {showRegister ? (
          <RegisterForm onSwitchToLogin={() => setShowRegister(false)} />
        ) : (
          <LoginForm onSwitchToRegister={() => setShowRegister(true)} />
        )}
      </div>
    );
  }

  // Show main app if authenticated
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Header user={user} onLogout={logout} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Canvas />
        </div>
      </div>
    </div>
  );
}

export default App;
