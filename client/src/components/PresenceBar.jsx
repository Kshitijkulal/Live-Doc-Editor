export default function PresenceBar({ users, typingUsers }) {
  return (
    <div className="presence-bar">
      <div className="presence-avatars">
        {users.map((u) => {
          const initials = (u.name || "?")
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <div
              key={u.id}
              className="presence-avatar"
              style={{ background: u.color || "#6c63ff" }}
              aria-label={u.name}
            >
              {initials}
              <span className="presence-tooltip">{u.name}</span>
            </div>
          );
        })}
      </div>

      <div className="online-count">
        <span className="online-dot" />
        {users.length} online
      </div>

      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
          {typingUsers.map((u) => u.name).join(", ")} typing…
        </div>
      )}
    </div>
  );
}