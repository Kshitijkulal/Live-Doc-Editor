import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import * as Y from "yjs";

import Editor from "./components/Editor";
import StatusBar from "./components/StatusBar";
import PresenceBar from "./components/PresenceBar";

import "./styles.css";

// ─── Colour palette for new users ───────────────────────
const PALETTE = [
  "#6c63ff", "#a78bfa", "#34d399",
  "#fbbf24", "#f472b6", "#38bdf8", "#fb7185",
];

// ─── Toast notification ──────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="toast-stack" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          {t.type === "error" ? "⚠ " : "ℹ "}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Name Modal ──────────────────────────────────────────
function NameModal({ onSubmit }) {
  const [name, setName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  };

  return (
    <div className="name-modal-overlay">
      <div
        className="name-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title">Welcome 👋</h2>
        <p>
          Enter your name to join the collaborative editor and start working
          with others in real time.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            id="name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name…"
            autoFocus
            maxLength={32}
          />
          <button id="join-btn" type="submit" disabled={!name.trim()}>
            Join Document →
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────
function App() {
  // Use state for ydoc so Editor re-renders when it's ready
  const [ydoc, setYdoc] = useState(null);
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connected, setConnected] = useState(socket.connected);

  const [status, setStatus] = useState("idle");
  const [lastSaved, setLastSaved] = useState(null);
  const [wordCount, setWordCount] = useState(0);

  const [toasts, setToasts] = useState([]);

  // Refs
  const statusTimerRef = useRef(null);
  const typingTimersRef = useRef({}); // userId → timeout id

  // ── Toast helper ────────────────────────────────────────
  const pushToast = useCallback((message, type = "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Init Ydoc once on mount ─────────────────────────────
  useEffect(() => {
    const doc = new Y.Doc();
    setYdoc(doc);

    // Resolve saved user
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("user"));
    } catch (_) {}

    if (saved?.name && saved?.id) {
      setUser(saved);
    } else {
      setShowModal(true);
    }

    return () => doc.destroy();
  }, []);

  // ── Socket connection status ────────────────────────────
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setUsers([]);
      setTypingUsers([]);
      setStatus("idle");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // ── Wire up all socket events once user + ydoc are ready
  useEffect(() => {
    if (!user || !ydoc) return;

    // ── Join the document room ────────────────────────────
    socket.emit("join_document", user);

    // ── document_state: load initial persisted Yjs state ──
    // Server sends: { success, type, data: { content: number[] } }
    const onDocumentState = (res) => {
      if (!res?.data?.content) return; // empty / first-time doc
      try {
        Y.applyUpdate(ydoc, new Uint8Array(res.data.content), "remote");
      } catch (err) {
        console.warn("[yjs] Failed to apply initial document state:", err);
      }
    };

    // ── yjs_update: remote peer made a change ─────────────
    // Server sends: { update: number[], user: User }
    const onYjsUpdate = ({ update }) => {
      if (!update) return;
      try {
        Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
      } catch (err) {
        console.warn("[yjs] Failed to apply remote update:", err);
      }
    };

    // ── presence_update: user list changed ────────────────
    // Server sends: User[]
    const onPresenceUpdate = (userList) => {
      setUsers(Array.isArray(userList) ? userList : []);
    };

    // ── user_typing: another user is typing ───────────────
    // Server sends: { user: User }
    const onUserTyping = ({ user: typingUser }) => {
      if (!typingUser?.id) return;

      // Add to typing list (deduplicated)
      setTypingUsers((prev) => {
        const exists = prev.some((u) => u.id === typingUser.id);
        return exists ? prev : [...prev, typingUser];
      });

      // Auto-clear after 2 s of silence
      clearTimeout(typingTimersRef.current[typingUser.id]);
      typingTimersRef.current[typingUser.id] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.id !== typingUser.id));
        delete typingTimersRef.current[typingUser.id];
      }, 2000);
    };

    // ── socket_error: server sent an error ────────────────
    // Server sends: { success, type, message }
    const onSocketError = ({ message }) => {
      console.error("[socket] Server error:", message);
      pushToast(message || "A server error occurred.");
    };

    // ── cursor_update: another user moved their cursor ─────
    // Server sends: { user: User, cursor: { start, end } }
    // (Informational only – stored for future cursor overlay)
    const onCursorUpdate = () => {};

    socket.on("document_state", onDocumentState);
    socket.on("yjs_update", onYjsUpdate);
    socket.on("presence_update", onPresenceUpdate);
    socket.on("user_typing", onUserTyping);
    socket.on("socket_error", onSocketError);
    socket.on("cursor_update", onCursorUpdate);

    // ── Broadcast local Yjs changes to server ─────────────
    // Tiptap's Collaboration extension applies local edits to ydoc.
    // Origin is NOT "remote", so the guard below only lets local
    // changes through and prevents re-broadcasting received updates.
    const onLocalUpdate = (update, origin) => {
      if (origin === "remote") return; // skip updates we applied ourselves
      socket.emit("yjs_update", Array.from(update));
    };

    ydoc.on("update", onLocalUpdate);

    return () => {
      socket.off("document_state", onDocumentState);
      socket.off("yjs_update", onYjsUpdate);
      socket.off("presence_update", onPresenceUpdate);
      socket.off("user_typing", onUserTyping);
      socket.off("socket_error", onSocketError);
      socket.off("cursor_update", onCursorUpdate);
      ydoc.off("update", onLocalUpdate);
    };
  }, [user, ydoc, pushToast]);

  // ── Handle name submission ──────────────────────────────
  const handleNameSubmit = (name) => {
    const newUser = {
      id: crypto.randomUUID(),
      name,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    };
    localStorage.setItem("user", JSON.stringify(newUser));
    setUser(newUser);
    setShowModal(false);
  };

  // ── Called by Editor on every keystroke ─────────────────
  const handleEditorUpdate = useCallback(() => {
    // 1. Emit "typing" event so server can broadcast user_typing to peers
    socket.emit("typing");

    // 2. Update local UI status with debounce
    setStatus("typing");
    clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setStatus("saved");
      setLastSaved(new Date());
    }, 1500);
  }, []);

  // ── Called by Editor when Yjs update is confirmed saved ─
  // (ydoc.on("update") already handles the network emit;
  //  this callback keeps the UI status indicator in sync)
  const handleYjsSaved = useCallback(() => {
    setLastSaved(new Date());
    setStatus("saved");
  }, []);

  // ── Called by Editor on cursor movement ─────────────────
  const handleCursorChange = useCallback((cursor) => {
    socket.emit("cursor_update", cursor);
  }, []);

  return (
    <>
      {showModal && <NameModal onSubmit={handleNameSubmit} />}

      <Toast toasts={toasts} />

      <div className="app-shell">
        {/* ── Header ── */}
        <header className="app-header">
          <div className="header-brand">
            <div className="brand-icon">✦</div>
            <span className="brand-name">
              Live<span>Doc</span>
            </span>
          </div>

          <PresenceBar users={users} typingUsers={typingUsers} />

          {/* Connection indicator */}
          <div
            className={`conn-badge ${connected ? "conn-badge--on" : "conn-badge--off"}`}
            title={connected ? "Connected to server" : "Disconnected"}
          >
            <span className="conn-dot" />
            {connected ? "Live" : "Offline"}
          </div>
        </header>

        {/* ── Editor area ── */}
        <main className="editor-area">
          {ydoc && user && (
            <Editor
              ydoc={ydoc}
              user={user}
              onWordCountChange={setWordCount}
              onUpdate={handleEditorUpdate}
              onYjsSaved={handleYjsSaved}
              onCursorChange={handleCursorChange}
            />
          )}
        </main>

        {/* ── Status bar ── */}
        <StatusBar
          status={status}
          lastSaved={lastSaved}
          wordCount={wordCount}
          connected={connected}
        />
      </div>
    </>
  );
}

export default App;