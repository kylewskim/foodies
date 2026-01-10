import { useState } from 'react';

interface ManualInputProps {
  onTextSubmitted: (text: string) => void;
}

export function ManualInput({ onTextSubmitted }: ManualInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (text.trim()) {
      onTextSubmitted(text);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>Manual Entry</h3>
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter grocery items (one per line)&#10;Example:&#10;2 Apples&#10;Milk&#10;3x Yogurt&#10;Chicken Breast"
          rows={10}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            fontFamily: 'monospace',
            marginTop: '10px',
            borderRadius: '4px',
            border: '1px solid #ddd',
          }}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          style={{
            marginTop: '10px',
            padding: '10px 20px',
            fontSize: '14px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: text.trim() ? 'pointer' : 'not-allowed',
            opacity: text.trim() ? 1 : 0.5,
          }}
        >
          Process Items
        </button>
      </form>
    </div>
  );
}
