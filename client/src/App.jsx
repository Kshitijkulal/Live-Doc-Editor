import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import * as Y from "yjs";

import Editor from "./components/Editor";
import StatusBar from "./components/StatusBar";
import PresenceBar from "./components/PresenceBar";

import "./styles.css";

// random color assigned to each new user so we can tell them apart
const PALETTE = [
  "#6c63ff",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#38bdf8",
  "#fb7185",
];

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

function App() {
  // ydoc in state so Editor re-mounts when we swap it (shouldn't happen, but just in case)
  const [isLoaded, setIsLoaded] = useState(false);
  const [ydoc, setYdoc] = useState(null);
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connected, setConnected] = useState(socket.connected);

  const [status, setStatus] = useState("idle");
  const [lastSaved, setLastSaved] = useState(null);
  const [wordCount, setWordCount] = useState(0);
  const [remoteCursors, setRemoteCursors] = useState({});

  const [toasts, setToasts] = useState([]);

  const statusTimerRef = useRef(null);
  const typingTimersRef = useRef({}); // per-user timeout ids for the typing indicator

  const pushToast = useCallback((message, type = "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  }, []);

  // create the Yjs doc once and try to restore user from localStorage.
  // if no saved user, show the name modal.
  useEffect(() => {
    const doc = new Y.Doc();
    setYdoc(doc);

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

  // track connection status for the UI indicator
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setUsers([]);
      setTypingUsers([]);
      setRemoteCursors({});
      setStatus("idle");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // main socket wiring - only runs once we have both user and ydoc.
  // everything in here is the core collaboration loop.
  useEffect(() => {
    if (!user || !ydoc) return;

    // server responds with the full Yjs state from the DB.
    // we apply it to our local doc so the editor shows existing content.
    const onDocumentState = (res) => {
      const update = res?.data?.content;

      if (update) {
        try {
          Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
        } catch (err) {
          console.warn("[yjs] Failed to apply initial document state:", err);
        }
      }

      // don't render the editor until we have the initial state,
      // otherwise tiptap initializes with empty content and it flickers
      setIsLoaded(true);
    };

    // incoming delta from another user's edits
    const onYjsUpdate = ({ update }) => {
      if (!update) return;
      try {
        Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
      } catch (err) {
        console.warn("[yjs] Failed to apply remote update:", err);
      }
    };

    const onPresenceUpdate = (userList) => {
      const list = Array.isArray(userList) ? userList : [];
      setUsers(list);
      const activeIds = new Set(list.map((u) => u.id));
      setRemoteCursors((prev) => {
        const next = {};
        for (const [id, entry] of Object.entries(prev)) {
          if (activeIds.has(id)) next[id] = entry;
        }
        return next;
      });
    };

    const onUserTyping = ({ user: typingUser }) => {
      if (!typingUser?.id) return;

      // deduplicate - don't add the same user twice
      setTypingUsers((prev) => {
        const exists = prev.some((u) => u.id === typingUser.id);
        return exists ? prev : [...prev, typingUser];
      });

      // auto-remove after 2s of silence. if they keep typing,
      // this timeout gets reset so the indicator stays visible.
      clearTimeout(typingTimersRef.current[typingUser.id]);
      typingTimersRef.current[typingUser.id] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.id !== typingUser.id));
        delete typingTimersRef.current[typingUser.id];
      }, 2000);
    };

    const onSocketError = ({ message }) => {
      console.error("[socket] Server error:", message);
      pushToast(message || "A server error occurred.");
    };

    const onCursorUpdate = ({ user: cursorUser, cursor }) => {
      if (!cursorUser?.id || cursorUser.id === user.id) return;
      setRemoteCursors((prev) => ({
        ...prev,
        [cursorUser.id]: { user: cursorUser, cursor },
      }));
    };

    // IMPORTANT: register listeners BEFORE emitting join_document.
    // learned this the hard way - if the server responds fast enough,
    // the document_state event arrives before the handler is attached
    // and the initial content just... disappears. fun times.
    socket.on("document_state", onDocumentState);
    socket.on("yjs_update", onYjsUpdate);
    socket.on("presence_update", onPresenceUpdate);
    socket.on("user_typing", onUserTyping);
    socket.on("socket_error", onSocketError);
    socket.on("cursor_update", onCursorUpdate);

    // now it's safe to join
    socket.emit("join_document", user);

    // if the socket reconnects (server restart, network blip, etc),
    // we need to re-join so the server sends us fresh state
    const onReconnect = () => {
      socket.emit("join_document", user);
    };
    socket.on("connect", onReconnect);

    // forward local Yjs changes to the server for persistence + broadcast.
    // the "remote" origin check prevents us from re-emitting updates
    // that we just received from other peers.
    const onLocalUpdate = (update, origin) => {
      if (origin === "remote") return;
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
      socket.off("connect", onReconnect);
      ydoc.off("update", onLocalUpdate);
    };
  }, [user, ydoc, pushToast]);

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

  // debounced status updates - show "typing" immediately,
  // then flip to "saved" after 1.5s of inactivity
  const handleEditorUpdate = useCallback(() => {
    socket.emit("typing");

    setStatus("typing");
    clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setStatus("saved");
      setLastSaved(new Date());
    }, 1500);
  }, []);

  // the actual network emit happens in ydoc.on("update") above,
  // this just keeps the status bar UI in sync
  const handleYjsSaved = useCallback(() => {
    setLastSaved(new Date());
    setStatus("saved");
  }, []);

  const handleCursorChange = useCallback((cursor) => {
    socket.emit("cursor_update", cursor);
  }, []);

  return (
    <>
      {showModal && <NameModal onSubmit={handleNameSubmit} />}

      <Toast toasts={toasts} />

      <div className="app-shell">
        <header className="app-header">
          <div className="header-brand">
            <div className="brand-icon">0S</div>
            <span className="brand-name">
              Live<span>Doc</span>
            </span>
          </div>

          <PresenceBar users={users} typingUsers={typingUsers} />

          <div
            className={`conn-badge ${connected ? "conn-badge--on" : "conn-badge--off"}`}
            title={connected ? "Connected to server" : "Disconnected"}
          >
            <span className="conn-dot" />
            {connected ? "Live" : "Offline"}
          </div>
        </header>

        <main className="editor-area">
          {ydoc && user && isLoaded && (
            <Editor
              ydoc={ydoc}
              user={user}
              remoteCursors={remoteCursors}
              onWordCountChange={setWordCount}
              onUpdate={handleEditorUpdate}
              onYjsSaved={handleYjsSaved}
              onCursorChange={handleCursorChange}
            />
          )}
        </main>

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
