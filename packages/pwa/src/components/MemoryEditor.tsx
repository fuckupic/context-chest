import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import { useAuth } from '../auth/context';
import { useChest } from '../context/chest-context';
import { decryptL2FromBytes, encryptL2, sha256 } from '../crypto';
import { decryptL2FromBytesLegacy } from '../crypto/legacy';
import { EditorToolbar } from './EditorToolbar';
import { exportMemoryAsMd } from '../lib/export';
import './editor-styles.css';

interface MemoryEditorProps {
  uri: string;
  l0: string;
  onDirtyChange?: (dirty: boolean) => void;
}

function extractSummaries(markdown: string): { l0: string; l1: string } {
  const lines = markdown.split('\n').filter((l) => l.trim().length > 0);
  const firstLine = (lines[0] ?? '').replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim();
  const l0 = firstLine.slice(0, 500);
  const plainText = markdown.replace(/[#*_`>\[\]()!~-]/g, '').replace(/\s+/g, ' ').trim();
  const l1 = plainText.slice(0, 500);
  return { l0, l1 };
}

export function MemoryEditor({ uri, l0, onDirtyChange }: MemoryEditorProps) {
  const { client, masterKey } = useAuth();
  const { activeChest } = useChest();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  const chestName = activeChest?.name ?? 'default';

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: 'Start typing...' }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
    ],
    content: '',
    onUpdate: () => {
      setDirty(true);
      onDirtyChange?.(true);
    },
  });

  // Auto-decrypt on mount / uri change
  useEffect(() => {
    if (!client || !masterKey || !editor) return;

    setLoading(true);
    setError(null);
    setDirty(false);
    onDirtyChange?.(false);

    client.getContent(uri)
      .then(async (encryptedBytes) => {
        let plaintext: Uint8Array;
        try {
          plaintext = await decryptL2FromBytes(masterKey, chestName, uri, encryptedBytes);
        } catch {
          try {
            plaintext = await decryptL2FromBytesLegacy(masterKey, uri, encryptedBytes);
          } catch {
            throw new Error('Decryption failed — memory may be corrupted or encrypted with a different key');
          }
        }
        const text = new TextDecoder().decode(plaintext);
        editor.commands.setContent(text);
        setDirty(false);
        onDirtyChange?.(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load memory');
      })
      .finally(() => setLoading(false));
  }, [uri, client, masterKey, editor, chestName]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!client || !masterKey || !editor || !dirty) return;

    setSaving(true);
    setError(null);
    try {
      const markdownExt = (editor.storage as unknown as { markdown: MarkdownStorage }).markdown;
      const markdown = markdownExt.getMarkdown();
      const plaintext = new TextEncoder().encode(markdown);
      const { l0: newL0, l1: newL1 } = extractSummaries(markdown);
      const encrypted = await encryptL2(masterKey, chestName, uri, plaintext);
      const encryptedBytes = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
      const hash = await sha256(encryptedBytes);

      await client.updateMemory(uri, { l0: newL0, l1: newL1, encryptedL2: encrypted, sha256: hash });
      setDirty(false);
      onDirtyChange?.(false);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      if (msg.includes('401')) setError('Session expired — please log in again');
      else if (msg.includes('429')) setError('Rate limited — try again in a moment');
      else setError(`Save failed — ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [client, masterKey, editor, dirty, chestName, uri, onDirtyChange]);

  const handleExport = useCallback(() => {
    if (!editor) return;
    const markdown = (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
    exportMemoryAsMd(markdown, uri, chestName);
  }, [editor, uri, chestName]);

  // Cmd+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleSave]);

  const pathSegments = uri.split('/');
  const fileName = pathSegments.pop() || uri;
  const dirPath = pathSegments.join('/');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-cc-border flex items-center gap-2 shrink-0 bg-cc-dark">
        {dirPath && <span className="font-mono text-[10px] text-cc-muted">{dirPath}/</span>}
        <span className="font-pixel text-sm text-cc-white tracking-wider">{fileName.toUpperCase()}</span>
        {dirty && <span className="w-2 h-2 rounded-full bg-cc-pink" title="Unsaved changes" />}
        {savedMessage && <span className="text-green-400 text-xs font-mono ml-2">Saved</span>}
        <div className="flex-1" />
        <button
          onClick={handleExport}
          className="font-pixel text-[10px] text-cc-muted hover:text-cc-pink tracking-wider transition-colors"
        >
          EXPORT
        </button>
        <span className="font-pixel text-[9px] text-cc-muted tracking-wider">{chestName}</span>
      </div>

      {/* Toolbar */}
      <EditorToolbar editor={editor} onSave={handleSave} saving={saving} dirty={dirty} />

      {/* Editor / Loading / Error */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-cc-sub">{l0}</p>
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-cc-surface rounded w-3/4" />
              <div className="h-3 bg-cc-surface rounded w-1/2" />
              <div className="h-3 bg-cc-surface rounded w-5/6" />
            </div>
          </div>
        )}

        {error && (
          <div className="m-4 border-2 border-red-500/30 bg-red-500/5 p-3 text-red-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-3">x</button>
          </div>
        )}

        {!loading && <div className="tiptap-editor"><EditorContent editor={editor} /></div>}
      </div>
    </div>
  );
}
