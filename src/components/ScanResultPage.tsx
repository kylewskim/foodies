import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Item, StorageLocation } from '../types';
import { ProductImage } from './ProductImage';

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

const SWIPE_THRESHOLD = 15;
const SWIPE_OPEN_THRESHOLD = 60;
const ACTION_WIDTH = 176;

export function ScanResultPage({
  items,
  receiptDate,
  onItemUpdate,
  onDeleteItems,
  onSaveAll,
  onAddItem,
  onDateChange,
  isSaving,
}: ScanResultPageProps) {
  const navigate = useNavigate();

  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showMoveToModal, setShowMoveToModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editableDate, setEditableDate] = useState<string>(
    receiptDate ? new Date(receiptDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  );

  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number>(0);
  const [touchCurrent, setTouchCurrent] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [touchedItemId, setTouchedItemId] = useState<string | null>(null);

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.location]) acc[item.location] = [];
    acc[item.location].push(item);
    return acc;
  }, {} as Record<StorageLocation, Item[]>);

  const locationLabels: Record<StorageLocation, string> = {
    fridge: 'Fridge',
    freezer: 'Freezer',
    pantry: 'Pantry',
  };

  const validItemCount = items.length;

  const formatDate = (dateString?: string) => {
    const date = dateString ? new Date(dateString) : new Date();
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

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

  const openEditItem = (item: Item) => {
    navigate('/edit-item', {
      state: {
        item,
        returnPath: '/add-item?method=review',
        processedItems: items,
      },
    });
  };

  const toggleItemSelection = (itemId: string) => {
    const next = new Set(selectedItems);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    setSelectedItems(next);
  };

  const handleMoveSelected = (newLocation: StorageLocation) => {
    items.forEach((item) => {
      if (selectedItems.has(item.itemId)) {
        onItemUpdate({ ...item, location: newLocation });
      }
    });
    setShowMoveToModal(false);
    setSelectedItems(new Set());
    setSelectMode(false);
  };

  const handleDeleteSelected = () => {
    if (selectedItems.size > 0) {
      onDeleteItems(Array.from(selectedItems));
    }
    setShowDeleteModal(false);
    setSelectedItems(new Set());
    setSwipedItemId(null);
    setSelectMode(false);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSwipedItemId(null);
    if (!selectMode) {
      setSelectedItems(new Set());
    }
  };

  const handleTrashItem = (itemId: string) => {
    onDeleteItems([itemId]);
    setSwipedItemId(null);
  };

  const handleTouchStart = (e: React.TouchEvent, itemId: string) => {
    if (selectMode) return;
    setTouchStart(e.touches[0].clientX);
    setTouchCurrent(e.touches[0].clientX);
    setTouchedItemId(itemId);
    setIsDragging(true);
    setIsSwipeActive(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || selectMode) return;
    const currentX = e.touches[0].clientX;
    setTouchCurrent(currentX);

    const moveDistance = Math.abs(touchStart - currentX);
    if (moveDistance > SWIPE_THRESHOLD && !isSwipeActive) {
      setIsSwipeActive(true);
      setSwipedItemId(touchedItemId);
    }
  };

  const handleTouchEnd = (itemId: string) => {
    if (selectMode) return;

    const swipeDistance = touchStart - touchCurrent;
    if (isSwipeActive) {
      if (swipeDistance > SWIPE_OPEN_THRESHOLD) {
        setSwipedItemId(itemId);
      } else {
        setSwipedItemId(null);
      }
    }

    setIsDragging(false);
    setTouchStart(0);
    setTouchCurrent(0);
    setTouchedItemId(null);
    setIsSwipeActive(false);
  };

  const displayDate = formatDate(editableDate);
  const singleSelectedItem =
    selectedItems.size === 1 ? items.find((item) => selectedItems.has(item.itemId)) ?? null : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f7f6ef',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          borderBottom: '1px solid rgba(17,19,11,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => (selectMode ? setSelectMode(false) : navigate('/'))}
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
              <path d="M8 1L1 9.5L8 18" stroke="#073d35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {!selectMode && (
              <button
                onClick={onAddItem}
                style={{
                  width: '24px',
                  height: '24px',
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Add item"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1V13M1 7H13" stroke="#11130b" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            )}

            <button
              onClick={() => {
                setSwipedItemId(null);
                setSelectedItems(new Set());
                setSelectMode((prev) => !prev);
              }}
              style={{
                width: '24px',
                height: '24px',
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Toggle bulk mode"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="6" r="1.8" fill="#11130b" />
                <circle cx="12" cy="12" r="1.8" fill="#11130b" />
                <circle cx="12" cy="18" r="1.8" fill="#11130b" />
              </svg>
            </button>
          </div>
        </div>

        <h1
          style={{
            margin: '8px 0 0 0',
            fontFamily: '"Poppins", sans-serif',
            fontSize: '28px',
            fontWeight: '400',
            color: '#11130b',
          }}
        >
          Scan Result
        </h1>

        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!selectMode ? (
            <button
              onClick={() => setShowDatePicker(true)}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="11" rx="2" stroke="#333" strokeOpacity="0.5" />
                <path d="M5 1.5V4M11 1.5V4M2 6H14" stroke="#333" strokeOpacity="0.5" strokeLinecap="round" />
              </svg>
              <span
                style={{
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  fontStyle: 'italic',
                  color: 'rgba(51,51,51,0.5)',
                }}
              >
                {displayDate}
              </span>
            </button>
          ) : (
            <div
              style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '14px',
                color: 'rgba(17,19,11,0.6)',
              }}
            >
              {selectedItems.size} selected
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: '16px 0',
          paddingBottom: selectMode ? '94px' : '140px',
          overflowY: 'auto',
        }}
      >
        {Object.entries(groupedItems).map(([location, locationItems]) => (
          <div key={location} style={{ marginBottom: '24px' }}>
            <h2
              style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '20px',
              fontWeight: '400',
              color: '#1a1a1a',
              margin: '0 0 12px 0',
              padding: '0 20px',
            }}
          >
            {locationLabels[location as StorageLocation]}
          </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {locationItems.map((item) => {
                const isSwipedOpen = swipedItemId === item.itemId;
                const isCurrentlyDragging = isDragging && touchedItemId === item.itemId && isSwipeActive;
                const dragOffset = Math.min(0, touchCurrent - touchStart);
                const swipeOffset = isCurrentlyDragging ? Math.max(-ACTION_WIDTH, dragOffset) : isSwipedOpen ? -ACTION_WIDTH : 0;

                return (
                  <div
                    key={item.itemId}
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '92px',
                      overflow: 'hidden',
                    }}
                  >
                    {!selectMode && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          height: '92px',
                          display: 'flex',
                          zIndex: 1,
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditItem(item);
                          }}
                          style={{
                            width: '88px',
                            height: '92px',
                            border: 'none',
                            backgroundColor: '#d7ed64',
                            color: '#073d33',
                            fontFamily: '"Poppins", sans-serif',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTrashItem(item.itemId);
                          }}
                          style={{
                            width: '88px',
                            height: '92px',
                            border: 'none',
                            backgroundColor: '#d8654a',
                            color: 'white',
                            fontFamily: '"Poppins", sans-serif',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    <div
                      onTouchStart={(e) => handleTouchStart(e, item.itemId)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={() => handleTouchEnd(item.itemId)}
                      onClick={() => {
                        if (selectMode) {
                          toggleItemSelection(item.itemId);
                          return;
                        }
                        if (isSwipeActive) return;
                        if (isSwipedOpen) {
                          setSwipedItemId(null);
                          return;
                        }
                        openEditItem(item);
                      }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '92px',
                        backgroundColor: '#f7f6ef',
                        borderBottom: '1px solid rgba(51,51,51,0.1)',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '16px',
                        paddingBottom: '16px',
                        paddingLeft: '20px',
                        paddingRight: '20px',
                        transform: `translateX(${selectMode ? 0 : swipeOffset}px)`,
                        transition: isCurrentlyDragging ? 'none' : 'transform 0.28s ease',
                        zIndex: 2,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <ProductImage imageUrl={item.imageUrl} name={item.name} category={item.category} size={60} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontFamily: '"Poppins", sans-serif',
                              fontSize: '16px',
                              color: '#000',
                              margin: 0,
                              textTransform: 'capitalize',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.name}
                          </p>
                          <p
                            style={{
                              fontFamily: '"Poppins", sans-serif',
                              fontSize: '12px',
                              color: 'rgba(0,0,0,0.4)',
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            In {location} | {getExpirationText(item)}
                          </p>
                        </div>
                      </div>

                      {selectMode ? (
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: `1.5px solid ${selectedItems.has(item.itemId) ? '#073d35' : '#b8b8b3'}`,
                            backgroundColor: selectedItems.has(item.itemId) ? '#073d35' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {selectedItems.has(item.itemId) && (
                            <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                              <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSwipedItemId(null);
                            setSelectedItems(new Set([item.itemId]));
                            setShowMoveToModal(true);
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            border: 'none',
                            background: 'none',
                            padding: 0,
                            cursor: 'pointer',
                          }}
                          aria-label="Move item"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3 4H13" stroke="#11130b" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
                            <path d="M3 8H13" stroke="#11130b" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
                            <path d="M3 12H13" stroke="#11130b" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectMode ? (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            height: '74px',
            paddingBottom: 'env(safe-area-inset-bottom)',
            backgroundColor: '#f7f6ef',
            borderTop: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            zIndex: 30,
          }}
        >
          <button
            onClick={() => setShowMoveToModal(true)}
            disabled={selectedItems.size === 0}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              cursor: selectedItems.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedItems.size === 0 ? 0.45 : 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#073d35' }}>Move To</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={selectedItems.size === 0}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              cursor: selectedItems.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedItems.size === 0 ? 0.45 : 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#073d35' }}>Delete</span>
          </button>
        </div>
      ) : (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#f7f6ef',
            borderTop: '1px solid #c6c6c6',
            padding: '12px 20px',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
            zIndex: 30,
          }}
        >
          <div style={{ marginBottom: '10px', fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a' }}>
            {validItemCount} foods found
          </div>
          <button
            onClick={onSaveAll}
            disabled={isSaving || items.length === 0}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '9999px',
              border: 'none',
              cursor: isSaving || items.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: isSaving || items.length === 0 ? '#ccc' : '#073d35',
              color: '#f7f6ef',
              fontFamily: '"Poppins", sans-serif',
              fontSize: '16px',
              fontWeight: '500',
            }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

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
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                borderBottom: '1px solid #ddd',
              }}
            >
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a' }}>Move To</span>
              <button
                onClick={() => setShowMoveToModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="#073d35" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '12px' }}>
              {(['fridge', 'freezer', 'pantry'] as StorageLocation[])
                .filter((loc) => (singleSelectedItem ? loc !== singleSelectedItem.location : true))
                .map((location) => (
                  <button
                    key={location}
                    onClick={() => handleMoveSelected(location)}
                    style={{
                      width: '100%',
                      height: '56px',
                      marginBottom: '12px',
                      borderRadius: '9999px',
                      border: '1.5px solid #073d35',
                      backgroundColor: '#d3e2d0',
                      color: '#484f46',
                      fontFamily: '"Poppins", sans-serif',
                      fontSize: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    {locationLabels[location]}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

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
          onClick={closeDeleteModal}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                borderBottom: '1px solid #ddd',
              }}
            >
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a' }}>Delete item?</span>
              <button
                onClick={closeDeleteModal}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="#073d35" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#073d35', lineHeight: '1.5' }}>
                This item will be removed from your inventory.
                <br />
                You can’t undo this action.
              </p>
            </div>

            <div style={{ padding: '12px' }}>
              <button
                onClick={handleDeleteSelected}
                style={{
                  width: '100%',
                  height: '56px',
                  marginBottom: '12px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: '#073d35',
                  color: '#f7f6ef',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
              <button
                onClick={closeDeleteModal}
                style={{
                  width: '100%',
                  height: '56px',
                  borderRadius: '9999px',
                  border: '1.5px solid #073d35',
                  backgroundColor: '#d3e2d0',
                  color: '#484f46',
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
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                borderBottom: '1px solid #ddd',
              }}
            >
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a' }}>Purchase Date</span>
              <button
                onClick={() => setShowDatePicker(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="#073d35" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 12px 0', fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#666' }}>
                Edit the purchase date for all items
              </p>
              <input
                type="date"
                value={editableDate}
                onChange={(e) => setEditableDate(e.target.value)}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '12px',
                  border: '1px solid #ccc',
                  padding: '0 16px',
                  boxSizing: 'border-box',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                }}
              />
            </div>

            <div style={{ padding: '12px' }}>
              <button
                onClick={() => {
                  if (onDateChange) onDateChange(new Date(editableDate).toISOString());
                  setShowDatePicker(false);
                }}
                style={{
                  width: '100%',
                  height: '56px',
                  marginBottom: '12px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: '#073d35',
                  color: '#f7f6ef',
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
                  height: '56px',
                  borderRadius: '9999px',
                  border: '1.5px solid #073d35',
                  backgroundColor: '#d3e2d0',
                  color: '#484f46',
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
