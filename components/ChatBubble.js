import ReactMarkdown from 'react-markdown';

export default function ChatBubble({ role, content, isMobile }) {
  const isUser = role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: isMobile ? 8 : 10
      }}
    >
      <div
        style={{
          maxWidth: isMobile ? '92%' : '85%',
          background: isUser ? 'var(--color-primary)' : 'var(--color-surface)',
          color: isUser ? 'var(--color-surface)' : 'var(--color-text)',
          border: `1px solid ${isUser ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 16,
          padding: isMobile ? '10px 12px' : '12px 14px',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          fontSize: isMobile ? 14 : 15,
          boxShadow: isUser
            ? '0 6px 18px rgba(var(--color-primary-rgb),0.16)'
            : '0 6px 18px rgba(var(--color-text-rgb),0.06)'
        }}
      >
        <ReactMarkdown
          components={{
            a: ({ node, ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
