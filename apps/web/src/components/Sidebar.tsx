import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalDocument } from '../services/idb';
import { 
  FileText, Plus, LogOut, Cloud, CloudOff, CloudLightning, 
  Trash2, RefreshCw 
} from 'lucide-react';

interface SidebarProps {
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
  onCreateDoc: () => void;
  onArchiveDoc: (id: string) => void;
  syncStatus: 'synced' | 'pending' | 'offline';
  onTriggerSync: () => void;
  user: { name: string; email: string } | null;
  onLogout: () => void;
}

export default function Sidebar({
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onArchiveDoc,
  syncStatus,
  onTriggerSync,
  user,
  onLogout,
}: SidebarProps) {
  // Query all active (non-archived) documents reactively from IndexedDB
  const documents = useLiveQuery(
    () => db.documents.where('isArchived').equals(0).toArray(),
    []
  );

  return (
    <aside className="sidebar">
      {/* Header Logo */}
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon">⚡</div>
          <span className="logo-text">d0c</span>
        </div>
        <button className="btn-icon" onClick={onCreateDoc} title="New Document">
          <Plus size={20} />
        </button>
      </div>

      {/* Main content */}
      <div className="sidebar-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="sidebar-section-title">Documents</span>
          
          {/* Sync badge trigger */}
          <button 
            onClick={onTriggerSync} 
            className={`sync-badge ${syncStatus}`}
            title="Force cloud sync"
            style={{ cursor: 'pointer', border: 'none', background: 'none' }}
          >
            {syncStatus === 'synced' && <Cloud size={14} />}
            {syncStatus === 'pending' && <CloudLightning size={14} className="spin-animation" />}
            {syncStatus === 'offline' && <CloudOff size={14} />}
            <span style={{ fontSize: '10px' }}>
              {syncStatus.toUpperCase()}
            </span>
          </button>
        </div>

        {/* Document list */}
        <ul className="sidebar-menu">
          {documents && documents.length > 0 ? (
            documents.map((doc) => (
              <li
                key={doc.id}
                className={`sidebar-item ${doc.id === activeDocId ? 'active' : ''}`}
                onClick={() => onSelectDoc(doc.id)}
              >
                <FileText size={16} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {doc.title || 'Untitled note'}
                </span>
                {!doc.isSynced && (
                  <span 
                    title="Unsynced local changes" 
                    style={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      background: 'var(--accent-secondary)' 
                    }}
                  />
                )}
                <div className="sidebar-item-actions">
                  <button
                    className="btn-icon"
                    style={{ padding: '2px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchiveDoc(doc.id);
                    }}
                    title="Archive note"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            ))
          ) : (
            <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', padding: '12px 14px' }}>
              No documents created. Click + to start.
            </div>
          )}
        </ul>
      </div>

      {/* Footer User Info */}
      {user && (
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </div>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={onLogout}
            style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
}
