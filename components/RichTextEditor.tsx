"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: { class: "rich-editor-content" },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [editor, value]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, label, title }: { onClick: () => void; active?: boolean; label: string; title: string }) => (
    <button
      onClick={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all"
      style={{
        background: active ? "var(--primary-light)" : "transparent",
        color: active ? "var(--primary)" : "var(--foreground-secondary)",
        border: active ? "1px solid var(--primary-light)" : "1px solid transparent",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-1 px-3 py-2 border-b flex-wrap" style={{ borderColor: "var(--border)", background: "var(--card-secondary)" }}>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} label="B" title="Bold" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} label="I" title="Italic" />
        <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} label="H2" title="Heading" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} label="H3" title="Subheading" />
        <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} label="• List" title="Bullet List" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} label="1. List" title="Numbered List" />
        <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} label="— Line" title="Divider" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} active={false} label="Undo" title="Undo" />
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} active={false} label="Redo" title="Redo" />
      </div>
      <div className="relative" style={{ background: "var(--background)", minHeight: "200px" }}>
        {editor.isEmpty && placeholder && (
          <p className="absolute top-4 left-4 text-sm pointer-events-none select-none" style={{ color: "var(--foreground-muted)" }}>{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .rich-editor-content { padding: 16px; min-height: 200px; outline: none; font-size: 14px; line-height: 1.7; color: var(--foreground); }
        .rich-editor-content h2 { font-size: 18px; font-weight: 700; margin: 16px 0 8px; }
        .rich-editor-content h3 { font-size: 15px; font-weight: 600; margin: 14px 0 6px; }
        .rich-editor-content p { margin: 6px 0; }
        .rich-editor-content ul { padding-left: 20px; list-style-type: disc; margin: 8px 0; }
        .rich-editor-content ol { padding-left: 20px; list-style-type: decimal; margin: 8px 0; }
        .rich-editor-content li { margin: 4px 0; }
        .rich-editor-content strong { font-weight: 700; }
        .rich-editor-content em { font-style: italic; }
        .rich-editor-content hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
      `}</style>
    </div>
  );
}
