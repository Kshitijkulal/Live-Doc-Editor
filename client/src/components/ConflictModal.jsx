export default function ConflictModal({ conflict, onAccept, onOverwrite }) {
  return (
    <div className="modal">
      <div className="modal-box">
        <h3>Conflict Detected</h3>

        <p><strong>Your version:</strong></p>
        <pre>{conflict.local}</pre>

        <p><strong>Server version:</strong></p>
        <pre>{conflict.server.content}</pre>

        <div className="modal-actions">
          <button onClick={onAccept}>Accept Server</button>
          <button onClick={onOverwrite}>Overwrite</button>
        </div>
      </div>
    </div>
  );
}