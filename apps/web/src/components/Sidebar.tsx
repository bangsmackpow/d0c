import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalDocument, type LocalSpace } from '../services/idb';
import { 
  FileText, Plus, LogOut, Cloud, CloudOff, CloudLightning, 
  Trash2, Folder, FolderOpen, ChevronRight, ChevronDown, 
  Edit3, Check, X, FolderPlus 
} from 'lucide-react';

interface SidebarProps {
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
  onCreateDoc: (spaceId: string | null) => void;
  onArchiveDoc: (id: string) => void;
  syncStatus: 'synced' | 'pending' | 'offline';
  onTriggerSync: () => void;
  user: { name: string; email: string } | null;
  onLogout: () => void;
  
  // Spaces features
  onCreateSpace: (name: string) => void;
  onRenameSpace: (id: string, name: string) => void;
  onDeleteSpace: (id: string) => void;
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
  onCreateSpace,
  onRenameSpace,
  onDeleteSpace,
}: SidebarProps) {
  // Query spaces reactively from IndexedDB
  const spaces = useLiveQuery(() => db.spaces.toArray(), []);
  
  // Query all active documents
  const documents = useLiveQuery(() => db.documents.where('isArchived').equals(0).toArray(), []);

  // UI state for creating spaces
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');

  // UI state for renaming spaces
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState('');

  // Track expanded spaces
  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({
    uncategorized: true // uncategorized open by default
  });

  const toggleSpaceExpand = (spaceId: string) => {
    setExpandedSpaces(prev => ({
      ...prev,
      [spaceId]: !prev[spaceId]
    }));
  };

  const handleCreateSpaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;
    onCreateSpace(newSpaceName.trim());
    setNewSpaceName('');
    setShowAddSpace(false);
  };

  const startRenameSpace = (id: string, currentName: string) => {
    setEditingSpaceId(id);
    setEditingSpaceName(currentName);
  };

  const saveSpaceRename = (id: string) => {
    if (!editingSpaceName.trim()) return;
    onRenameSpace(id, editingSpaceName.trim());
    setEditingSpaceId(null);
  };

  return (
    <aside className="sidebar">
      {/* Header Logo */}
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon">⚡</div>
          <span className="logo-text">d0c</span>
        </div>
        
        <div style={{ display: 'flex', gap: '4px' }}>
          <button 
            className="btn-icon" 
            onClick={() => setShowAddSpace(!showAddSpace)} 
            title="New Space"
          >
            <FolderPlus size={18} />
          </button>
          <button 
            className="btn-icon" 
            onClick={() => onCreateDoc(null)} 
            title="New Note (Uncategorized)"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="sidebar-content">
        {/* Sync status section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span className="sidebar-section-title">Workspaces</span>
          <button 
            onClick={onTriggerSync} 
            className={`sync-badge ${syncStatus}`}
            title="Sync offline cache with server"
            style={{ cursor: 'pointer', border: 'none', background: 'none' }}
          >
            {syncStatus === 'synced' && <Cloud size={12} />}
            {syncStatus === 'pending' && <CloudLightning size={12} className="spin-animation" />}
            {syncStatus === 'offline' && <CloudOff size={12} />}
            <span style={{ fontSize: '9px', marginLeft: '4px' }}>
              {syncStatus.toUpperCase()}
            </span>
          </button>
        </div>

        {/* Create Space Input Field */}
        {showAddSpace && (
          <form onSubmit={handleCreateSpaceSubmit} style={{ marginBottom: '12px', display: 'flex', gap: '6px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Space name..."
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              autoFocus
              style={{ padding: '6px 10px', fontSize: '13px' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '6px 10px' }} title="Save">
              <Check size={14} />
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowAddSpace(false)} 
              style={{ padding: '6px 10px' }}
              title="Cancel"
            >
              <X size={14} />
            </button>
          </form>
        )}

        {/* Spaces list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Dynamic Spaces */}
          {spaces && spaces.map(space => {
            const spaceDocs = documents?.filter(d => d.spaceId === space.id) || [];
            const isExpanded = !!expandedSpaces[space.id];
            const isEditing = editingSpaceId === space.id;

            return (
              <div key={space.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Space Header Row */}
                <div 
                  className="sidebar-item" 
                  style={{ 
                    padding: '6px 8px', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)',
                    background: 'rgba(255,255,255,0.02)'
                  }}
                  onClick={() => toggleSpaceExpand(space.id)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }} onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        className="input-field"
                        value={editingSpaceName}
                        onChange={(e) => setEditingSpaceName(e.target.value)}
                        autoFocus
                        style={{ padding: '2px 6px', fontSize: '13px' }}
                      />
                      <button className="btn-icon" onClick={() => saveSpaceRename(space.id)} style={{ padding: '2px' }}>
                        <Check size={12} />
                      </button>
                      <button className="btn-icon" onClick={() => setEditingSpaceId(null)} style={{ padding: '2px' }}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {isExpanded ? <FolderOpen size={16} color="var(--accent-primary)" /> : <Folder size={16} color="var(--accent-primary)" />}
                      <span style={{ marginLeft: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {space.name}
                      </span>
                    </>
                  )}

                  {!isEditing && (
                    <div className="sidebar-item-actions" onClick={e => e.stopPropagation()}>
                      <button 
                        className="btn-icon" 
                        onClick={() => onCreateDoc(space.id)} 
                        title="New Note in Space"
                        style={{ padding: '2px' }}
                      >
                        <Plus size={12} />
                      </button>
                      <button 
                        className="btn-icon" 
                        onClick={() => startRenameSpace(space.id, space.name)} 
                        title="Rename Space"
                        style={{ padding: '2px' }}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button 
                        className="btn-icon" 
                        onClick={() => onDeleteSpace(space.id)} 
                        title="Delete Space"
                        style={{ padding: '2px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Documents in Space */}
                {isExpanded && (
                  <ul className="sidebar-menu" style={{ paddingLeft: '20px', marginTop: '4px' }}>
                    {spaceDocs.map(doc => (
                      <li
                        key={doc.id}
                        className={`sidebar-item ${doc.id === activeDocId ? 'active' : ''}`}
                        onClick={() => onSelectDoc(doc.id)}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      >
                        <FileText size={14} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {doc.title || 'Untitled note'}
                        </span>
                        {!doc.isSynced && (
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-secondary)' }} />
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
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </li>
                    ))}
                    {spaceDocs.length === 0 && (
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', padding: '6px 12px' }}>
                        Empty space. Click + to add note.
                      </div>
                    )}
                  </ul>
                )}
              </div>
            );
          })}

          {/* Uncategorized Notes Section */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div 
              className="sidebar-item" 
              style={{ 
                padding: '6px 8px', 
                fontWeight: 600, 
                color: 'var(--text-primary)',
                background: 'rgba(255,255,255,0.02)'
              }}
              onClick={() => toggleSpaceExpand('uncategorized')}
            >
              <span style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                {expandedSpaces['uncategorized'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <Folder size={16} color="var(--text-secondary)" />
              <span style={{ marginLeft: '6px', flex: 1 }}>Uncategorized</span>
              <div className="sidebar-item-actions" onClick={e => e.stopPropagation()}>
                <button 
                  className="btn-icon" 
                  onClick={() => onCreateDoc(null)} 
                  title="New Note (Uncategorized)"
                  style={{ padding: '2px' }}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {expandedSpaces['uncategorized'] && (
              <ul className="sidebar-menu" style={{ paddingLeft: '20px', marginTop: '4px' }}>
                {documents?.filter(d => d.spaceId === null || d.spaceId === undefined).map(doc => (
                  <li
                    key={doc.id}
                    className={`sidebar-item ${doc.id === activeDocId ? 'active' : ''}`}
                    onClick={() => onSelectDoc(doc.id)}
                    style={{ padding: '6px 10px', fontSize: '13px' }}
                  >
                    <FileText size={14} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {doc.title || 'Untitled note'}
                    </span>
                    {!doc.isSynced && (
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-secondary)' }} />
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
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </li>
                ))}
                {(documents?.filter(d => d.spaceId === null || d.spaceId === undefined).length === 0) && (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', padding: '6px 12px' }}>
                    No uncategorized notes.
                  </div>
                )}
              </ul>
            )}
          </div>

        </div>
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
