import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalDocument } from './services/idb';
import { authClient, syncDocuments } from './services/api';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import { FileText, Save, ArrowRight, Loader2 } from 'lucide-react';

export default function App() {
  // --- AUTHENTICATION STATE ---
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // --- WORKSPACE STATE ---
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'offline'>(
    navigator.onLine ? 'synced' : 'offline'
  );

  // Check Better Auth session on mount
  const checkSession = async () => {
    try {
      const res = await authClient.getSession();
      if (res && res.data) {
        setSession(res.data);
      } else {
        setSession(null);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
      setSession(null);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  // Fetch active document reactively from IndexedDB
  const activeDoc = useLiveQuery(
    () => (activeDocId ? db.documents.get(activeDocId) : undefined),
    [activeDocId]
  ) as LocalDocument | undefined;

  // Trigger sync loop
  const triggerSync = async () => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    
    // We check if there are unsynced changes
    const unsyncedCount = await db.documents.where('isSynced').equals(0).count();
    if (unsyncedCount > 0) {
      setSyncStatus('pending');
    }

    const res = await syncDocuments();
    if (res.success) {
      setSyncStatus('synced');
    } else {
      if (res.error === 'Unauthorized') {
        // Sign out client if backend rejects credentials
        setSession(null);
      }
      setSyncStatus('offline');
    }
  };

  // Sync interval
  useEffect(() => {
    if (!session) return;
    
    triggerSync();
    const interval = setInterval(() => {
      triggerSync();
    }, 10000); // sync every 10 seconds

    return () => clearInterval(interval);
  }, [session]);

  // Handle Online/Offline window events
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('synced');
      triggerSync();
    };
    const handleOffline = () => setSyncStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Automatically select the first note if no note is active
  const documents = useLiveQuery(() => db.documents.where('isArchived').equals(0).toArray());
  useEffect(() => {
    if (session && documents && documents.length > 0 && !activeDocId) {
      setActiveDocId(documents[0].id);
    }
  }, [documents, activeDocId, session]);

  // --- ACTIONS ---

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmittingAuth(true);

    try {
      if (isSignUp) {
        const { data, error } = await authClient.signUp.email({
          email: authEmail,
          password: authPassword,
          name: authName,
        });
        if (error) throw new Error(error.message || 'Registration failed');
        await checkSession();
      } else {
        const { data, error } = await authClient.signIn.email({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw new Error(error.message || 'Invalid credentials');
        await checkSession();
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    await db.documents.clear(); // Clear local cache on signout
    setSession(null);
    setActiveDocId(null);
  };

  const createNewDoc = async () => {
    const id = crypto.randomUUID();
    const newDoc: LocalDocument = {
      id,
      title: 'Untitled Note',
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Start writing here or type / for formatting commands...' }]
          }
        ]
      }),
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isSynced: false,
    };

    await db.documents.put(newDoc);
    setActiveDocId(id);
    triggerSync();
  };

  const handleArchiveDoc = async (id: string) => {
    await db.documents.update(id, {
      isArchived: true,
      updatedAt: Date.now(),
      isSynced: false,
    });
    if (activeDocId === id) {
      setActiveDocId(null);
    }
    triggerSync();
  };

  const handleDocTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeDocId) return;
    const newTitle = e.target.value;
    await db.documents.update(activeDocId, {
      title: newTitle,
      updatedAt: Date.now(),
      isSynced: false,
    });
    setSyncStatus('pending');
  };

  const handleDocContentChange = async (contentJson: string) => {
    if (!activeDocId) return;
    await db.documents.update(activeDocId, {
      content: contentJson,
      updatedAt: Date.now(),
      isSynced: false,
    });
    setSyncStatus('pending');
  };

  // --- RENDERING ---

  if (loadingSession) {
    return (
      <div className="auth-container">
        <Loader2 className="spin-animation" size={48} color="var(--accent-primary)" />
      </div>
    );
  }

  // Render Authentication Portal if not logged in
  if (!session) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="logo-icon" style={{ margin: '0 auto 16px auto' }}>⚡</div>
            <h1 className="auth-title">Welcome to d0c</h1>
            <p className="auth-subtitle">
              {isSignUp ? 'Create a local-first documentation account' : 'Sign in to access your notes'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {isSignUp && (
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  className="input-field"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                placeholder="you@domain.com"
                className="input-field"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="input-field"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </div>

            {authError && (
              <div style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>
                {authError}
              </div>
            )}

            <button type="submit" disabled={submittingAuth} className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              {submittingAuth ? (
                <Loader2 className="spin-animation" size={16} />
              ) : (
                <>
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="auth-switch">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError('');
              }}
              style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent-primary)' }}
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Dashboard Workspace
  return (
    <div className="app-container">
      <Sidebar
        activeDocId={activeDocId}
        onSelectDoc={setActiveDocId}
        onCreateDoc={createNewDoc}
        onArchiveDoc={handleArchiveDoc}
        syncStatus={syncStatus}
        onTriggerSync={triggerSync}
        user={session.user}
        onLogout={handleLogout}
      />

      <main className="main-workspace">
        {/* Header toolbar */}
        <header className="workspace-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <FileText size={16} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>
              {activeDoc ? (activeDoc.isSynced ? 'Saved to Cloud' : 'Saving locally...') : 'No Document Selected'}
            </span>
          </div>
          <div className="workspace-actions">
            {activeDoc && !activeDoc.isSynced && (
              <button 
                className="btn btn-secondary" 
                onClick={triggerSync} 
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <Save size={14} />
                Sync Now
              </button>
            )}
          </div>
        </header>

        {/* Scrollable editor workspace */}
        <div className="workspace-scroll-container">
          {activeDoc ? (
            <div className="workspace-document-wrapper">
              <input
                type="text"
                className="doc-title-input"
                value={activeDoc.title}
                onChange={handleDocTitleChange}
                placeholder="Untitled Note"
              />
              <Editor
                content={activeDoc.content}
                onChange={handleDocContentChange}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-tertiary)' }}>
              <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3>Select a document or create a new one to begin.</h3>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
