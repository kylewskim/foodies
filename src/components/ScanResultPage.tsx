import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Item, StorageLocation } from '../types';
// Helper function is defined inline

interface ScanResultPageProps {
  items: Item[];
  receiptDate?: string;
  onItemUpdate: (item: Item) => void;
  onDeleteItems: (itemIds: string[]) => void;
  onSaveAll: () => void;
  onAddItem: () => void;
  onDateChange?: (newDate: string) => void;
  isSaving: boolean;
}

export function ScanResultPage({
  items,
  receiptDate,
  onItemUpdate,
  onDeleteItems,
  onSaveAll,
  onAddItem,
  onDateChange,
  isSaving
}: ScanResultPageProps) {
  const navigate = useNavigate();
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showMoveToModal, setShowMoveToModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editableDate, setEditableDate] = useState<string>(
    receiptDate ? new Date(receiptDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );

  // Group items by location
  const groupedItems = items.reduce((acc, item) => {
    const location = item.location;
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push(item);
    return acc;
  }, {} as Record<StorageLocation, Item[]>);

  const formatDate = (dateString?: string) => {
    // If no date, use today's date
    const date = dateString ? new Date(dateString) : new Date();
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  // Display date: use editableDate (which is kept in sync with receiptDate)
  const displayDate = formatDate(editableDate);

  const getExpirationText = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    if (!expirationDate) return 'No expiration';
    const expDate = new Date(expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expired';
    if (days === 1) return 'Expires tomorrow';
    return `Expires in ${days} ds`;
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleMoveSelected = (newLocation: StorageLocation) => {
    items.forEach(item => {
      if (selectedItems.has(item.itemId)) {
        onItemUpdate({ ...item, location: newLocation });
      }
    });
    setShowMoveToModal(false);
    setSelectedItems(new Set());
    setSelectMode(false);
  };

  const handleDeleteSelected = () => {
    // Actually delete items from the list
    onDeleteItems(Array.from(selectedItems));
    setShowDeleteModal(false);
    setSelectedItems(new Set());
    setSelectMode(false);
  };

  const handleItemClick = (item: Item) => {
    if (selectMode) {
      toggleItemSelection(item.itemId);
    } else {
      // Navigate to edit item
      navigate('/edit-item', { 
        state: { 
          item, 
          returnPath: '/add-item?method=review',
          processedItems: items 
        } 
      });
    }
  };

  const locationLabels: Record<StorageLocation, string> = {
    fridge: 'Fridge',
    freezer: 'Freezer',
    pantry: 'Pantry',
  };

  const currentLocation = items.length > 0 ? items[0].location : 'fridge';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Back button */}
            <button
              onClick={() => selectMode ? setSelectMode(false) : navigate('/')}
              style={{
                width: '40px',
                height: '40px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="19" viewBox="0 0 16 19" fill="none">
                <path d="M8 1L1 9.5L8 18" stroke="#073d35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Title */}
            <h1 style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '28px',
              fontWeight: '400',
              color: '#11130b',
              margin: 0,
            }}>
              {selectMode ? 'Select Items' : 'Scan Result'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Receipt date - clickable to edit */}
            {!selectMode && (
              <button
                onClick={() => setShowDatePicker(true)}
                style={{
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  fontStyle: 'italic',
                  color: '#333',
                  opacity: 0.5,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {displayDate}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M9 1.5L10.5 3L4.5 9H3V7.5L9 1.5Z" stroke="#333" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* 3-dot menu button */}
            <button
              onClick={() => setShowMoreModal(true)}
              style={{
                width: '32px',
                height: '32px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="8" r="2" fill="#073d35"/>
                <circle cx="16" cy="16" r="2" fill="#073d35"/>
                <circle cx="16" cy="24" r="2" fill="#073d35"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Items list */}
      <div style={{
        flex: 1,
        padding: '0 20px',
        paddingBottom: selectMode ? '94px' : '140px',
        overflow: 'auto',
      }}>
        {Object.entries(groupedItems).map(([location, locationItems]) => (
          <div key={location} style={{ marginBottom: '24px' }}>
            {/* Location title */}
            <h2 style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '20px',
              fontWeight: '400',
              color: '#1a1a1a',
              marginBottom: '12px',
            }}>
              {locationLabels[location as StorageLocation]}
            </h2>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {locationItems.map((item) => (
                <div 
                  key={item.itemId}
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Item image placeholder */}
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px',
                      backgroundColor: '#d3e2d0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                    }}>
                      🥬
                    </div>

                    {/* Item info */}
                    <div>
                      <p style={{
                        fontFamily: '"Poppins", sans-serif',
                        fontSize: '16px',
                        color: '#000',
                        margin: 0,
                        textTransform: 'capitalize',
                      }}>
                        {item.name}
                      </p>
                      <p style={{
                        fontFamily: '"Poppins", sans-serif',
                        fontSize: '12px',
                        color: 'rgba(0,0,0,0.4)',
                        margin: 0,
                      }}>
                        In {location} | {getExpirationText(item)}
                      </p>
                    </div>
                  </div>

                  {/* Selection circle or edit button */}
                  {selectMode ? (
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: `2px solid ${selectedItems.has(item.itemId) ? '#073d35' : '#ccc'}`,
                      backgroundColor: selectedItems.has(item.itemId) ? '#073d35' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {selectedItems.has(item.itemId) && (
                        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                          <path d="M1 6L6 11L15 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#d3e2d0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {/* Pencil/Edit icon */}
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M14.166 2.5009C14.3849 2.28203 14.6447 2.10842 14.9307 1.98996C15.2167 1.87151 15.5232 1.81055 15.8327 1.81055C16.1422 1.81055 16.4487 1.87151 16.7347 1.98996C17.0206 2.10842 17.2805 2.28203 17.4993 2.5009C17.7182 2.71977 17.8918 2.97961 18.0103 3.26558C18.1287 3.55154 18.1897 3.85804 18.1897 4.16757C18.1897 4.4771 18.1287 4.7836 18.0103 5.06956C17.8918 5.35553 17.7182 5.61537 17.4993 5.83424L6.24935 17.0842L1.66602 18.3342L2.91602 13.7509L14.166 2.5009Z" stroke="#073d35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom action bar */}
      {selectMode ? (
        // Select mode bottom bar
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#f7f6ef',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          height: '74px',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          <button
            onClick={() => setShowMoveToModal(true)}
            disabled={selectedItems.size === 0}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              border: 'none',
              background: 'none',
              cursor: selectedItems.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedItems.size === 0 ? 0.5 : 1,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 9L12 2L19 9" stroke="#073d35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 2V16" stroke="#073d35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 22H19" stroke="#073d35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '12px',
              fontWeight: '500',
              color: '#073d35',
              textTransform: 'capitalize',
            }}>
              move to
            </span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={selectedItems.size === 0}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              border: 'none',
              background: 'none',
              cursor: selectedItems.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedItems.size === 0 ? 0.5 : 1,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2.5 5H17.5" stroke="#073d35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 9V14" stroke="#073d35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 9V14" stroke="#073d35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.5 5L4.5 17C4.5 17.5 5 18 5.5 18H14.5C15 18 15.5 17.5 15.5 17L16.5 5" stroke="#073d35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 5V3C7 2.5 7.5 2 8 2H12C12.5 2 13 2.5 13 3V5" stroke="#073d35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '12px',
              fontWeight: '500',
              color: '#073d35',
              textTransform: 'capitalize',
            }}>
              Delete
            </span>
          </button>
        </div>
      ) : (
        // Normal bottom bar
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#f7f6ef',
          borderTop: '1px solid #c6c6c6',
          padding: '12px 20px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        }}>
          <div style={{ marginBottom: '10px' }}>
            <span style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '20px',
              color: '#1a1a1a',
            }}>
              {items.filter(i => !i.itemId.startsWith('deleted_')).length} foods found
            </span>
          </div>
          <button
            onClick={onSaveAll}
            disabled={isSaving || items.length === 0}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: isSaving ? '#ccc' : '#073d35',
              color: '#f7f6ef',
              border: 'none',
              borderRadius: '9999px',
              fontFamily: '"Poppins", sans-serif',
              fontSize: '16px',
              fontWeight: '500',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {isSaving ? 'Adding...' : 'Add To Items'}
          </button>
        </div>
      )}

      {/* More Modal */}
      {showMoreModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
          }}
          onClick={() => setShowMoreModal(false)}
        >
          <div 
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px',
              borderBottom: '1px solid #ccc',
            }}>
              <span style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '20px',
                color: '#1a1a1a',
              }}>
                More
              </span>
              <button
                onClick={() => setShowMoreModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M10 10L22 22M22 10L10 22" stroke="#073d35" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Modal buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px',
            }}>
              <button
                onClick={() => {
                  setShowMoreModal(false);
                  onAddItem();
                }}
                style={{
                  width: '100%',
                  padding: '15px 50px',
                  backgroundColor: '#d3e2d0',
                  color: '#484f46',
                  border: '1.5px solid #073d35',
                  borderRadius: '9999px',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                Add an Item
              </button>
              <button
                onClick={() => {
                  setShowMoreModal(false);
                  setSelectMode(true);
                }}
                style={{
                  width: '100%',
                  padding: '15px 50px',
                  backgroundColor: '#d3e2d0',
                  color: '#484f46',
                  border: '1.5px solid #073d35',
                  borderRadius: '9999px',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                Select Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move To Modal */}
      {showMoveToModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
          }}
          onClick={() => setShowMoveToModal(false)}
        >
          <div 
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px',
              borderBottom: '1px solid #ccc',
            }}>
              <span style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '20px',
                color: '#1a1a1a',
              }}>
                Move To
              </span>
              <button
                onClick={() => setShowMoveToModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M10 10L22 22M22 10L10 22" stroke="#073d35" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Location options */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px',
            }}>
              {(['fridge', 'freezer', 'pantry'] as StorageLocation[])
                .filter(loc => loc !== currentLocation)
                .map(location => (
                  <button
                    key={location}
                    onClick={() => handleMoveSelected(location)}
                    style={{
                      width: '100%',
                      padding: '15px 50px',
                      backgroundColor: '#d3e2d0',
                      color: '#484f46',
                      border: '1.5px solid #073d35',
                      borderRadius: '9999px',
                      fontFamily: '"Poppins", sans-serif',
                      fontSize: '16px',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {locationLabels[location]}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div 
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px',
              borderBottom: '1px solid #ccc',
            }}>
              <span style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '20px',
                color: '#1a1a1a',
              }}>
                Delete item?
              </span>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M10 10L22 22M22 10L10 22" stroke="#073d35" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Warning text */}
            <div style={{ padding: '20px' }}>
              <p style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '14px',
                color: '#073d35',
                margin: 0,
                lineHeight: '1.5',
              }}>
                This item will be removed from your inventory.
                <br />
                You can't undo this action.
              </p>
            </div>

            {/* Action buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px',
            }}>
              <button
                onClick={handleDeleteSelected}
                style={{
                  width: '100%',
                  padding: '15px',
                  backgroundColor: '#073d35',
                  color: '#f7f6ef',
                  border: 'none',
                  borderRadius: '9999px',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  width: '100%',
                  padding: '15px 50px',
                  backgroundColor: '#d3e2d0',
                  color: '#484f46',
                  border: '1.5px solid #073d35',
                  borderRadius: '9999px',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
          }}
          onClick={() => setShowDatePicker(false)}
        >
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px',
              borderBottom: '1px solid #ccc',
            }}>
              <span style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '20px',
                color: '#1a1a1a',
              }}>
                Purchase Date
              </span>
              <button
                onClick={() => setShowDatePicker(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M10 10L22 22M22 10L10 22" stroke="#073d35" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Date picker */}
            <div style={{ padding: '20px' }}>
              <p style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '14px',
                color: '#666',
                margin: '0 0 12px 0',
              }}>
                Edit the purchase date for all items
              </p>
              <input
                type="date"
                value={editableDate}
                onChange={(e) => setEditableDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '16px',
                  fontFamily: '"Poppins", sans-serif',
                  border: '1px solid #ccc',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Action buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px 20px 20px',
            }}>
              <button
                onClick={() => {
                  if (onDateChange) {
                    onDateChange(new Date(editableDate).toISOString());
                  }
                  setShowDatePicker(false);
                }}
                style={{
                  width: '100%',
                  padding: '15px',
                  backgroundColor: '#073d35',
                  color: '#f7f6ef',
                  border: 'none',
                  borderRadius: '9999px',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Update Date
              </button>
              <button
                onClick={() => setShowDatePicker(false)}
                style={{
                  width: '100%',
                  padding: '15px 50px',
                  backgroundColor: '#d3e2d0',
                  color: '#484f46',
                  border: '1.5px solid #073d35',
                  borderRadius: '9999px',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
