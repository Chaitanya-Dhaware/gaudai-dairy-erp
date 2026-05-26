import { useAppStore } from './store/appStore';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './views/Login';
import HomeDashboard from './views/HomeDashboard';
import CollectionWorkspace from './views/CollectionWorkspace';
import CustomerWorkspace from './views/CustomerWorkspace';
import ExpenseWorkspace from './views/ExpenseWorkspace';
import AccountsWorkspace from './views/AccountsWorkspace';
import Settings from './views/Settings';

const toastStyle = {
  duration: 3000,
  style: {
    background: '#FFFFFF',
    color: '#1A1A1A',
    border: '1px solid rgba(0,0,0,0.08)',
    fontFamily: 'Inter, Noto Sans Devanagari, sans-serif',
    fontSize: '13px'
  }
};

// Full-screen loading splash shown while Firebase restores auth session
function AuthLoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#F8FAF9', gap: '20px'
    }}>
      <img
        src="/src/assets/gaudai-logo.png"
        alt="गौदाई"
        style={{ width: '140px', height: 'auto', objectFit: 'contain' }}
      />
      <div style={{
        width: '28px', height: '28px', border: '3px solid #e5e7eb',
        borderTop: '3px solid #0F6E56', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#6b7280', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
        Loading Gaudai Dairy…
      </p>
    </div>
  );
}

function App() {
  const { user, loadingAuth, activeWorkspace } = useAppStore();

  // While Firebase is still checking auth state, show a loading screen
  // This prevents the flash of the Login page on every page reload
  if (loadingAuth) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return (
      <>
        <Login />
        <Toaster position="top-right" toastOptions={toastStyle} />
      </>
    );
  }

  return (
    <>
      <Layout>
        {activeWorkspace === 'dashboard' && <HomeDashboard />}
        {activeWorkspace === 'collection' && <CollectionWorkspace />}
        {activeWorkspace === 'customers' && <CustomerWorkspace />}
        {activeWorkspace === 'expenses' && <ExpenseWorkspace />}
        {activeWorkspace === 'accounts' && <AccountsWorkspace />}
        {activeWorkspace === 'settings' && <Settings />}
      </Layout>
      <Toaster position="top-right" toastOptions={toastStyle} />
    </>
  );
}

export default App;
