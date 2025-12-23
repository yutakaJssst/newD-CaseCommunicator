import { useEffect, useState, useMemo } from 'react';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Canvas } from './components/Canvas/Canvas';
import { LoginForm } from './components/Auth/LoginForm';
import { RegisterForm } from './components/Auth/RegisterForm';
import { ProjectList } from './components/Projects/ProjectList';
import { LoadingState } from './components/Status/LoadingState';
import { useAuthStore } from './stores/authStore';
import { useDiagramStore } from './stores/diagramStore';
import { projectAPI } from './services/api';
import { websocketService } from './services/websocket';

function App() {
  // Use individual selectors to avoid unnecessary re-renders
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const logout = useAuthStore((state) => state.logout);

  const setCurrentProject = useDiagramStore((state) => state.setCurrentProject);
  const initializeWebSocket = useDiagramStore((state) => state.initializeWebSocket);
  const disconnectWebSocket = useDiagramStore((state) => state.disconnectWebSocket);
  const setProjectRole = useDiagramStore((state) => state.setProjectRole);

  const [showRegister, setShowRegister] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Memoize user ID to prevent infinite loops
  const userId = useMemo(() => user?.id, [user?.id]);

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
    if (isAuthenticated && user && userId) {
      const userName = user.firstName || user.lastName
        ? `${user.lastName || ''} ${user.firstName || ''}`.trim()
        : user.email;

      initializeWebSocket(userId, userName);
      console.log('[App] WebSocket initialized for user:', userName);

      return () => {
        disconnectWebSocket();
        console.log('[App] WebSocket disconnected');
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId]); // Only re-run when authentication status or user ID changes

  // Join/leave project room when selectedProjectId changes
  useEffect(() => {
    if (isAuthenticated && user && userId && selectedProjectId) {
      const userName = user.firstName || user.lastName
        ? `${user.lastName || ''} ${user.firstName || ''}`.trim()
        : user.email;

      websocketService.joinProject(selectedProjectId, userId, userName);
      console.log('[App] Joined project room:', selectedProjectId);

      return () => {
        if (selectedProjectId) {
          websocketService.leaveProject(selectedProjectId);
          console.log('[App] Left project room:', selectedProjectId);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId, selectedProjectId]); // user is only used to get userName, safe to omit

  // Save selected project to localStorage and update diagram store
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('selectedProjectId', selectedProjectId);
      setCurrentProject(selectedProjectId);
    } else {
      localStorage.removeItem('selectedProjectId');
      setCurrentProject(null);
      setProjectRole(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]); // setCurrentProject は Zustand の安定したアクションなので依存配列に含めない

  // Load project role for permission-aware UI
  useEffect(() => {
    if (!selectedProjectId || !user) {
      setProjectRole(null);
      return;
    }

    let canceled = false;
    const loadRole = async () => {
      try {
        const response = await projectAPI.getById(selectedProjectId);
        const project = response.project;
        const role =
          project.ownerId === user.id
            ? 'owner'
            : project.members?.find((member) => member.user.id === user.id)?.role || null;
        if (!canceled) {
          setProjectRole(role);
        }
      } catch (error) {
        console.error('Failed to load project role:', error);
        if (!canceled) {
          setProjectRole(null);
        }
      }
    };

    loadRole();

    return () => {
      canceled = true;
    };
  }, [selectedProjectId, user, setProjectRole]);

  console.log('App render:', { isAuthenticated, isLoading, user, selectedProjectId });

  // Show loading state while checking authentication
  if (isLoading) {
    return <LoadingState fullScreen />;
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
