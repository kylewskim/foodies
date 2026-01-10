import type { Item } from '../types';
import { ItemRow } from './ItemRow';

interface ItemListProps {
  items: Item[];
  onItemUpdate: (updatedItem: Item) => void;
  onSaveAll: () => void;
  isSaving: boolean;
}

export function ItemList({ items, onItemUpdate, onSaveAll, isSaving }: ItemListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Processed Items ({items.length})</h2>
        <button
          onClick={onSaveAll}
          disabled={isSaving}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.5 : 1,
            fontWeight: 'bold',
          }}
        >
          {isSaving ? 'Saving...' : 'Save All to Firestore'}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Item Name</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Quantity</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Category</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Expiration</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ItemRow key={item.itemId} item={item} onUpdate={onItemUpdate} />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '6px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#004085' }}>
          <strong>Note:</strong> Auto-estimated expiration dates are labeled as recommendations. 
          You can edit any date by clicking the "Edit" button. Manual dates will override automatic estimates.
        </p>
      </div>
    </div>
  );
}
