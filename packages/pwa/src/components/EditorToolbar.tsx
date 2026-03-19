import { Editor } from '@tiptap/react';

interface EditorToolbarProps {
  editor: Editor | null;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

function ToolbarButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs font-mono transition-colors ${
        active ? 'text-cc-pink bg-cc-pink-glow' : 'text-cc-muted hover:text-cc-white'
      }`}
    >
      {label}
    </button>
  );
}

export function EditorToolbar({ editor, onSave, saving, dirty }: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b-2 border-cc-border bg-cc-dark flex-wrap">
      <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="B" />
      <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="I" />
      <ToolbarButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} label="<>" />
      <div className="w-px h-4 bg-cc-border mx-1" />
      <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="H1" />
      <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="H2" />
      <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="H3" />
      <div className="w-px h-4 bg-cc-border mx-1" />
      <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="&bull;" />
      <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="1." />
      <ToolbarButton active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} label="[]" />
      <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} label=">" />
      <ToolbarButton active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="{}" />
      <div className="flex-1" />
      <button
        onClick={onSave}
        disabled={saving || !dirty}
        className={`px-3 py-1 font-pixel text-[10px] tracking-wider border-2 transition-colors ${
          dirty
            ? 'border-cc-pink text-cc-pink hover:bg-cc-pink hover:text-cc-black'
            : 'border-cc-border text-cc-muted'
        } disabled:opacity-50`}
      >
        {saving ? 'SAVING...' : 'SAVE'}
      </button>
    </div>
  );
}
