import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { useEffect, useState, useRef } from 'react';
import { 
  Heading1, Heading2, Heading3, List, ListOrdered, 
  Quote, Code, Image as ImageIcon, Sparkles 
} from 'lucide-react';

interface EditorProps {
  content: string; // JSON string
  onChange: (contentJson: string) => void;
}

interface CommandItem {
  name: string;
  description: string;
  icon: any;
  action: (editor: any, triggerImageUpload?: () => void) => void;
}

const COMMANDS: CommandItem[] = [
  {
    name: 'Heading 1',
    description: 'Big section heading',
    icon: Heading1,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    name: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    name: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    name: 'Bullet List',
    description: 'Simple bulleted list',
    icon: List,
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    name: 'Numbered List',
    description: 'Sequential ordered list',
    icon: ListOrdered,
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    name: 'Blockquote',
    description: 'Insert a quote block',
    icon: Quote,
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    name: 'Code Block',
    description: 'Code snippet container',
    icon: Code,
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    name: 'Upload Image',
    description: 'Add image from local storage',
    icon: ImageIcon,
    action: (_, triggerImageUpload) => {
      if (triggerImageUpload) triggerImageUpload();
    },
  },
];

export default function Editor({ content, onChange }: EditorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable default styling or shortcuts if needed
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
    ],
    content: content ? JSON.parse(content) : { type: 'doc', content: [] },
    onUpdate: ({ editor }) => {
      const jsonStr = JSON.stringify(editor.getJSON());
      onChange(jsonStr);

      // Handle Slash Commands Detection
      const { selection } = editor.state;
      const { $from } = selection;
      
      // Get text of current block up to cursor
      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 1), 
        $from.parentOffset, 
        null, 
        '\n'
      );

      if (textBefore === '/') {
        try {
          const rect = editor.view.dom.getBoundingClientRect();
          const coords = editor.view.coordsAtPos($from.pos);
          
          setMenuPosition({
            top: coords.bottom - rect.top + 10,
            left: coords.left - rect.left,
          });
          setMenuOpen(true);
          setSelectedIndex(0);
        } catch (e) {
          console.warn('Could not compute slash menu positioning coords', e);
        }
      } else {
        setMenuOpen(false);
      }
    },
  });

  // Keep editor content in sync when document changes outside the editor
  useEffect(() => {
    if (!editor || !content) return;
    const currentJson = JSON.stringify(editor.getJSON());
    if (content !== currentJson) {
      editor.commands.setContent(JSON.parse(content), false);
    }
  }, [content, editor]);

  // Handle keyboard navigation inside the editor when Slash Menu is active
  useEffect(() => {
    if (!editor || !menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % COMMANDS.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + COMMANDS.length) % COMMANDS.length);
        return true;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        executeCommand(COMMANDS[selectedIndex]);
        return true;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        editor.commands.focus();
        return true;
      }
      return false;
    };

    editor.on('selectionUpdate', () => {
      // Close menu if cursor moves away
      setMenuOpen(false);
    });

    const dom = editor.view.dom;
    dom.addEventListener('keydown', handleKeyDown, true);
    return () => {
      dom.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [editor, menuOpen, selectedIndex]);

  const executeCommand = (command: CommandItem) => {
    if (!editor) return;

    // Delete the "/" typed character
    const { selection } = editor.state;
    const { $from } = selection;
    editor.chain().focus().deleteRange({ from: $from.pos - 1, to: $from.pos }).run();
    
    setMenuOpen(false);

    // Run action
    command.action(editor, () => {
      fileInputRef.current?.click();
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      if (data.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } catch (err) {
      console.error('Error uploading image to storage server:', err);
      alert('Failed to upload image. Please verify you are logged in and connected.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Hidden File Input for Image Uploads */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />

      {/* Editor Content Area */}
      <EditorContent editor={editor} />

      {/* Custom floating slash commands menu */}
      {menuOpen && (
        <div 
          className="slash-commands-menu"
          style={{ 
            top: `${menuPosition.top}px`, 
            left: `${menuPosition.left}px` 
          }}
        >
          {COMMANDS.map((cmd, idx) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.name}
                className={`slash-command-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="slash-command-icon">
                  <Icon size={16} />
                </div>
                <div className="slash-command-text">
                  <span className="slash-command-name">{cmd.name}</span>
                  <span className="slash-command-description">{cmd.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
