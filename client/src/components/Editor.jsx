import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { Collaboration } from "@tiptap/extension-collaboration";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// toolbar icons - inline SVGs because importing an icon library
// for 12 icons felt like overkill

const BoldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
  </svg>
);

const ItalicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <line x1="19" y1="4" x2="10" y2="4" />
    <line x1="14" y1="20" x2="5" y2="20" />
    <line x1="15" y1="4" x2="9" y2="20" />
  </svg>
);

const UnderlineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
    <line x1="4" y1="21" x2="20" y2="21" />
  </svg>
);

const StrikeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.6 0 1.5 1.8 3.3 3.3 4.4" />
    <path d="M10 12.9c-1.5 1.1-3.3 2.9-3.3 4.4 0 2.9 2.6 3.6 5.3 3.6 1.8.1 3.9-.3 6.2-.9" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);

const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const HighlightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <line x1="4" y1="20" x2="20" y2="20" />
    <rect x="3" y="3" width="18" height="10" rx="2" />
  </svg>
);

const H1Icon = () => (
  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>H1</span>
);
const H2Icon = () => (
  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>H2</span>
);
const H3Icon = () => (
  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>H3</span>
);

const QuoteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
  </svg>
);

const BulletListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <line x1="9" y1="6" x2="20" y2="6" />
    <line x1="9" y1="12" x2="20" y2="12" />
    <line x1="9" y1="18" x2="20" y2="18" />
    <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const OrderedListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <line x1="10" y1="6" x2="21" y2="6" />
    <line x1="10" y1="12" x2="21" y2="12" />
    <line x1="10" y1="18" x2="21" y2="18" />
    <path d="M4 6h1v4" />
    <path d="M4 10h2" />
    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
  </svg>
);

const UndoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

const RedoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
  </svg>
);

function Toolbar({ editor }) {
  if (!editor) return null;

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      <div className="toolbar-group">
        <button
          id="toolbar-undo"
          className="toolbar-btn"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (⌘Z)"
        >
          <UndoIcon />
        </button>
        <button
          id="toolbar-redo"
          className="toolbar-btn"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (⌘⇧Z)"
        >
          <RedoIcon />
        </button>
      </div>

      <div className="toolbar-group">
        <button
          id="toolbar-h1"
          className={`toolbar-btn ${editor.isActive("heading", { level: 1 }) ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          <H1Icon />
        </button>
        <button
          id="toolbar-h2"
          className={`toolbar-btn ${editor.isActive("heading", { level: 2 }) ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <H2Icon />
        </button>
        <button
          id="toolbar-h3"
          className={`toolbar-btn ${editor.isActive("heading", { level: 3 }) ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <H3Icon />
        </button>
      </div>

      <div className="toolbar-group">
        <button
          id="toolbar-bold"
          className={`toolbar-btn ${editor.isActive("bold") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (⌘B)"
        >
          <BoldIcon />
        </button>
        <button
          id="toolbar-italic"
          className={`toolbar-btn ${editor.isActive("italic") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (⌘I)"
        >
          <ItalicIcon />
        </button>
        <button
          id="toolbar-underline"
          className={`toolbar-btn ${editor.isActive("underline") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (⌘U)"
        >
          <UnderlineIcon />
        </button>
        <button
          id="toolbar-strike"
          className={`toolbar-btn ${editor.isActive("strike") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <StrikeIcon />
        </button>
        <button
          id="toolbar-code"
          className={`toolbar-btn ${editor.isActive("code") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline Code"
        >
          <CodeIcon />
        </button>
        <button
          id="toolbar-highlight"
          className={`toolbar-btn ${editor.isActive("highlight") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="Highlight"
        >
          <HighlightIcon />
        </button>
      </div>

      <div className="toolbar-group">
        <label title="Text Color" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
          <input
            id="toolbar-color"
            type="color"
            className="toolbar-color-input"
            defaultValue="#a78bfa"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
      </div>

      <div className="toolbar-group">
        <button
          id="toolbar-blockquote"
          className={`toolbar-btn ${editor.isActive("blockquote") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          <QuoteIcon />
        </button>
        <button
          id="toolbar-bullet-list"
          className={`toolbar-btn ${editor.isActive("bulletList") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <BulletListIcon />
        </button>
        <button
          id="toolbar-ordered-list"
          className={`toolbar-btn ${editor.isActive("orderedList") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          <OrderedListIcon />
        </button>
      </div>
    </div>
  );
}

export default function Editor({
  ydoc,
  user,
  remoteCursors,
  onWordCountChange,
  onUpdate,
  onYjsSaved,
  onCursorChange,
}) {
  const cursorsPluginKey = useRef(new PluginKey("remoteCursors")).current;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // collaboration extension handles its own undo/redo via Yjs,
        // so we disable the built-in one to avoid conflicts
        undoRedo: false,
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Collaboration.configure({ document: ydoc }),
    ],
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        "data-placeholder": "Start writing something amazing\u2026",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      if (onWordCountChange) onWordCountChange(wordCount);
      if (onUpdate) onUpdate();
    },
    onSelectionUpdate: ({ editor }) => {
      if (!onCursorChange) return;
      const { from, to } = editor.state.selection;
      onCursorChange({ start: from, end: to });
    },
  });

  useEffect(() => {
    if (!editor) return;

    const existing = editor.state.plugins.find(
      (p) => p.spec.key === cursorsPluginKey
    );
    if (existing) {
      editor.view.dispatch(
        editor.state.tr.setMeta(cursorsPluginKey, remoteCursors)
      );
      return;
    }

    const plugin = new Plugin({
      key: cursorsPluginKey,
      state: {
        init: () => remoteCursors || {},
        apply: (tr, prev) => {
          const meta = tr.getMeta(cursorsPluginKey);
          return meta !== undefined ? meta : prev;
        },
      },
      props: {
        decorations: (state) => {
          const cursors = cursorsPluginKey.getState(state);
          if (!cursors) return DecorationSet.empty;

          const decorations = [];
          const docSize = state.doc.content.size;

          for (const entry of Object.values(cursors)) {
            const { user: cursorUser, cursor } = entry;
            if (!cursor) continue;

            const start = Math.min(cursor.start, docSize);
            const end = Math.min(cursor.end, docSize);
            const color = cursorUser.color || "#6c63ff";

            const caretEl = document.createElement("span");
            caretEl.className = "collaboration-cursor__caret";
            caretEl.style.borderColor = color;

            const labelEl = document.createElement("span");
            labelEl.className = "collaboration-cursor__label";
            labelEl.style.backgroundColor = color;
            labelEl.textContent = cursorUser.name;
            caretEl.appendChild(labelEl);

            decorations.push(
              Decoration.widget(start, caretEl, {
                side: 1,
                key: `cursor-${cursorUser.id}`,
              })
            );

            if (start !== end) {
              decorations.push(
                Decoration.inline(start, end, {
                  class: "collaboration-cursor__selection",
                  style: `background: ${color}22;`,
                })
              );
            }
          }

          return DecorationSet.create(state.doc, decorations);
        },
      },
    });

    const newState = editor.state.reconfigure({
      plugins: [...editor.state.plugins, plugin],
    });
    editor.view.updateState(newState);
  }, [editor, remoteCursors, cursorsPluginKey]);

  // listen for local ydoc updates to keep the "saved" status in sync.
  // we only care about local changes here (not remote applies),
  // since those are the ones we're actually persisting.
  useEffect(() => {
    if (!ydoc || !onYjsSaved) return;

    const handler = (_update, origin) => {
      if (origin !== "remote") {
        onYjsSaved();
      }
    };

    ydoc.on("update", handler);
    return () => ydoc.off("update", handler);
  }, [ydoc, onYjsSaved]);

  return (
    <>
      <Toolbar editor={editor} />
      <div className="tiptap-wrapper">
        <EditorContent editor={editor} />
      </div>
    </>
  );
}