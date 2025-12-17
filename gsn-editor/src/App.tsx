import { useEffect, useState } from 'react';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Canvas } from './components/Canvas/Canvas';
import { LoginForm } from './components/Auth/LoginForm';
import { RegisterForm } from './components/Auth/RegisterForm';
import { ProjectList } from './components/Projects/ProjectList';
import { useAuthStore } from './stores/authStore';
import { useDiagramStore } from './stores/diagramStore';
import { websocketService } from './services/websocket';

function App() {
  const { isAuthenticated, checkAuth, logout, user, isLoading } = useAuthStore();
  const { setCurrentProject, initializeWebSocket, disconnectWebSocket } = useDiagramStore();
  const [showRegister, setShowRegister] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    console.log('App mounted, checking auth...');
    checkAuth();
    // Load selected project from localStorage if exists
    const savedProjectId = localStorage.getItem('selectedProjectId');
    if (savedProjectId) {
      setSelectedProjectId(savedProjectId);
      setCurrentProject(savedProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize WebSocket when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const userName = user.firstName || user.lastName
        ? `${user.lastName || ''} ${user.firstName || ''}`.trim()
        : user.email;

      initializeWebSocket(user.id, userName);
      console.log('[App] WebSocket initialized for user:', userName);

      return () => {
        disconnectWebSocket();
        console.log('[App] WebSocket disconnected');
      };
    }
  }, [isAuthenticated, user, initializeWebSocket, disconnectWebSocket]);

  // Join/leave project room when selectedProjectId changes
  useEffect(() => {
    if (isAuthenticated && user && selectedProjectId) {
      const userName = user.firstName || user.lastName
        ? `${user.lastName || ''} ${user.firstName || ''}`.trim()
        : user.email;

      websocketService.joinProject(selectedProjectId, user.id, userName);
      console.log('[App] Joined project room:', selectedProjectId);

      return () => {
        if (selectedProjectId) {
          websocketService.leaveProject(selectedProjectId);
          console.log('[App] Left project room:', selectedProjectId);
        }
      };
    }
  }, [isAuthenticated, user, selectedProjectId]);

  // Save selected project to localStorage and update diagram store
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('selectedProjectId', selectedProjectId);
      setCurrentProject(selectedProjectId);
    } else {
      localStorage.removeItem('selectedProjectId');
      setCurrentProject(null);
    }
  }, [selectedProjectId, setCurrentProject]);

  console.log('App render:', { isAuthenticated, isLoading, user, selectedProjectId });

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

  // Show project list if authenticated but no project selected
  if (!selectedProjectId) {
    return <ProjectList onSelectProject={setSelectedProjectId} user={user} onLogout={logout} />;
  }

  // Show main app if authenticated and project selected
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
      <Header
        user={user}
        onLogout={logout}
        onBackToProjects={() => setSelectedProjectId(null)}
      />
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
