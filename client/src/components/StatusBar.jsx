export default function StatusBar({ status, lastSaved, wordCount, connected }) {
  const statusMap = {
    typing: { label: "Typing…", cls: "typing" },
    saved:  { label: "Saved",   cls: "saved"  },
    idle:   { label: "Ready",   cls: "idle"   },
  };

  const { label, cls } = statusMap[status] ?? statusMap.idle;

  const formattedTime = lastSaved
    ? lastSaved.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className="status-bar" role="status" aria-live="polite">
      <div className="status-left">
        <div className={`status-indicator ${connected === false ? "idle" : cls}`}>
          <div className="status-dot" />
          {connected === false ? "Disconnected" : label}
          {formattedTime && connected !== false && (
            <span style={{ opacity: 0.55, marginLeft: 4 }}>· {formattedTime}</span>
          )}
        </div>
      </div>

      <div className="status-right">
        <span className="word-count">
          {wordCount ?? 0} {wordCount === 1 ? "word" : "words"}
        </span>
        <span>Live Doc Editor</span>
      </div>
    </div>
  );
}