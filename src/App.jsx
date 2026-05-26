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

function App() {
  const { user, activeWorkspace } = useAppStore();

  if (!user) {
    return (
      <>
        <Login />
        <Toaster 
          position="top-right" 
          toastOptions={{
            duration: 3000,
            style: {
              background: '#FFFFFF',
              color: '#1A1A1A',
              border: '1px solid rgba(0,0,0,0.08)',
              fontFamily: 'Noto Sans Devanagari, DM Sans, sans-serif',
              fontSize: '13px'
            }
          }}
        />
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
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 3000,
          style: {
            background: '#FFFFFF',
            color: '#1A1A1A',
            border: '1px solid rgba(0,0,0,0.08)',
            fontFamily: 'Noto Sans Devanagari, DM Sans, sans-serif',
            fontSize: '13px'
          }
        }}
      />
    </>
  );
}

export default App;
