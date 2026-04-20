export default function PresenceBar({ users, typingUsers }) {
  return (
    <div className="presence">
      <div>
        <strong>{users.length}</strong> online
      </div>

      <div className="presence-users">
        {users.map((u) => (
          <span key={u.id} style={{ color: u.color }}>
            ● {u.name}
          </span>
        ))}
      </div>

      {typingUsers.length > 0 && (
        <div className="typing">
          {typingUsers.map((u) => u.name).join(", ")} typing...
        </div>
      )}
    </div>
  );
}