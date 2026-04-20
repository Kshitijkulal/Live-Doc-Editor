export default function Editor({ content, setContent }) {
  return (
    <textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      className="editor"
      placeholder="Start typing..."
    />
  );
}