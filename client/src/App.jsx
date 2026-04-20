import { useEffect, useState } from "react";
import { socket } from "./socket";
import { useAutosave } from "./hooks/useAutosave";

import Editor from "./components/Editor";
import StatusBar from "./components/StatusBar";
import PresenceBar from "./components/PresenceBar";
import ConflictModal from "./components/ConflictModal";

import "./styles.css";

// 🔹 USER SETUP
const getUser = () => {
  let user = JSON.parse(localStorage.getItem("user"));

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      name: prompt("Enter your name") || "Anonymous",
      color: "#" + Math.floor(Math.random() * 16777215).toString(16),
    };
    localStorage.setItem("user", JSON.stringify(user));
  }

  return user;
};

function App() {
  const [content, setContent] = useState("");
  const [version, setVersion] = useState(null);
  const [status, setStatus] = useState("idle");
  const [lastSaved, setLastSaved] = useState(null);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [conflict, setConflict] = useState(null);

  // 🔌 SOCKET SETUP
  useEffect(() => {
    const user = getUser();

    socket.emit("join_document", user);

    const handleState = (res) => {
      setContent(res.data.content);
      setVersion(res.data.version);
    };

    const handleUpdate = (res) => {
      setContent(res.data.content);
      setVersion(res.data.version);
      setLastSaved(new Date());
      setStatus("saved");
    };

    const handleConflict = (res) => {
      setStatus("conflict");
      setConflict({
        server: res.data.server,
        local: content,
      });
    };

    const handlePresence = (list) => {
      setUsers(list);
    };

    const handleTyping = ({ user }) => {
      setTypingUsers((prev) => {
        if (prev.find((u) => u.id === user.id)) return prev;
        return [...prev, user];
      });

      setTimeout(() => {
        setTypingUsers((prev) =>
          prev.filter((u) => u.id !== user.id)
        );
      }, 1200);
    };

    socket.on("document_state", handleState);
    socket.on("document_updated", handleUpdate);
    socket.on("document_conflict", handleConflict);
    socket.on("presence_update", handlePresence);
    socket.on("user_typing", handleTyping);

    return () => {
      socket.off("document_state", handleState);
      socket.off("document_updated", handleUpdate);
      socket.off("document_conflict", handleConflict);
      socket.off("presence_update", handlePresence);
      socket.off("user_typing", handleTyping);
    };
  }, []);

  // ⚡ AUTOSAVE
  useAutosave(() => {
    if (version === null) return;

    setStatus("saving");

    socket.emit("edit_document", {
      content,
      version,
    });
  }, 1000, [content]);

  // 🔹 typing throttle
  let typingTimeout = null;

  const handleTypingEmit = () => {
    if (!typingTimeout) {
      socket.emit("typing");

      typingTimeout = setTimeout(() => {
        typingTimeout = null;
      }, 500);
    }
  };

  return (
    <div className="container">
      <h1>Realtime Editor</h1>

      <PresenceBar users={users} typingUsers={typingUsers} />

      <Editor
        content={content}
        setContent={(val) => {
          setContent(val);
          setStatus("typing");
          handleTypingEmit();
        }}
      />

      <StatusBar status={status} lastSaved={lastSaved} />

      {conflict && (
        <ConflictModal
          conflict={conflict}
          onAccept={() => {
            setContent(conflict.server.content);
            setVersion(conflict.server.version);
            setConflict(null);
          }}
          onOverwrite={() => {
            socket.emit("edit_document", {
              content: conflict.local,
              version: conflict.server.version,
            });
            setConflict(null);
          }}
        />
      )}
    </div>
  );
}

export default App;