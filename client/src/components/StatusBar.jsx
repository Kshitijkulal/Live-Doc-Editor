export default function StatusBar({ status, lastSaved }) {
  const map = {
    typing: "Typing...",
    saving: "Saving...",
    saved: "Saved ✓",
    conflict: "Conflict ⚠️",
    error: "Error ❌",
  };

  return (
    <div className="status">
      {map[status] || ""}
      {lastSaved && (
        <span> • {lastSaved.toLocaleTimeString()}</span>
      )}
    </div>
  );
}