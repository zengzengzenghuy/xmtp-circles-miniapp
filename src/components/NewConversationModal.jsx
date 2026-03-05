import React, { useState, useEffect, useRef } from 'react';

function NewConversationModal({ isOpen, onClose, onCreateConversation }) {
  const [mode, setMode] = useState(null); // null, 'dm', or 'group'
  const [recipientInput, setRecipientInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [groupMembers, setGroupMembers] = useState([]);
  const searchTimeoutRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setMode(null);
      setRecipientInput('');
      setSearchResults([]);
      setIsSearching(false);
      setSelectedIndex(-1);
      setGroupMembers([]);
    }
  }, [isOpen]);

  // Search Circles profiles by name
  const searchCirclesProfiles = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    // Skip search if input looks like an address (starts with 0x)
    if (query.startsWith('0x')) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(
        `https://rpc.aboutcircles.com/profiles/search?name=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error searching Circles profiles:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for 1 second
    searchTimeoutRef.current = setTimeout(() => {
      searchCirclesProfiles(recipientInput);
    }, 1000);

    // Cleanup on unmount or when input changes
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [recipientInput]);

  const handleSelectResult = (address) => {
    if (mode === 'group') {
      // For group mode, add to members array
      handleAddMember(address);
    } else {
      // For DM mode, create conversation immediately
      onCreateConversation(address);
      setRecipientInput('');
      setSearchResults([]);
      onClose();
    }
  };

  const handleSubmit = () => {
    if (recipientInput.trim()) {
      if (mode === 'group') {
        // For group mode, add to members array
        handleAddMember(recipientInput.trim());
      } else {
        // For DM mode, create conversation immediately
        onCreateConversation(recipientInput.trim());
        setRecipientInput('');
        setSearchResults([]);
        onClose();
      }
    }
  };

  const handleAddMember = (address) => {
    // Add address to temporary array if not already added
    if (!groupMembers.includes(address)) {
      const updatedMembers = [...groupMembers, address];
      setGroupMembers(updatedMembers);
      console.log('Group members:', updatedMembers);
    }
    // Clear input after adding
    setRecipientInput('');
    setSearchResults([]);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    // Handle dropdown navigation
    if (searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handleSelectResult(searchResults[selectedIndex].address);
        } else {
          handleSubmit();
        }
        return;
      }
    } else {
      // No dropdown - standard behavior
      if (e.key === 'Enter') {
        handleSubmit();
      }
    }

    if (e.key === 'Escape') {
      if (searchResults.length > 0) {
        setSearchResults([]);
        setSelectedIndex(-1);
      } else {
        onClose();
      }
    }
  };

  const handleInputChange = (e) => {
    setRecipientInput(e.target.value);
    setSelectedIndex(-1); // Reset selection when typing
  };

  if (!isOpen) return null;

  const showDropdown = searchResults.length > 0 && recipientInput.length >= 2;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Message</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {mode === null ? (
            // Mode selection view
            <div className="mode-selection">
              <button
                className="mode-selection-btn"
                onClick={() => setMode('dm')}
              >
                Add new dm
              </button>
              <button
                className="mode-selection-btn"
                onClick={() => setMode('group')}
              >
                Add new group chat
              </button>
            </div>
          ) : (
            // Search view (for both DM and Group)
            <>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <button
                  className="back-btn"
                  onClick={() => setMode(null)}
                  style={{ marginRight: '0.5rem' }}
                >
                  ← Back
                </button>
                <label className="modal-label">
                  {mode === 'group' ? 'Add Members' : 'Recipient'}
                </label>
              </div>

              {mode === 'group' && groupMembers.length > 0 && (
                <div className="group-members-list" style={{ marginBottom: '1rem' }}>
                  <strong>Members ({groupMembers.length}):</strong>
                  {groupMembers.map((member, index) => (
                    <div key={index} style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                      {member}
                    </div>
                  ))}
                </div>
              )}

              <div className="search-input-container">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="Enter name or wallet address (0x...)"
                      value={recipientInput}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                    {isSearching && (
                      <div className="search-loading">Searching...</div>
                    )}
                    {showDropdown && (
                      <div className="search-results-dropdown">
                        {searchResults.slice(0, 5).map((result, index) => (
                          <div
                            key={result.address}
                            className={`search-result-item ${
                              index === selectedIndex ? 'selected' : ''
                            }`}
                            onClick={() => handleSelectResult(result.address)}
                            onMouseEnter={() => setSelectedIndex(index)}
                          >
                            <div className="search-result-name">{result.name}</div>
                            <div className="search-result-address">
                              {result.address}
                            </div>
                          </div>
                        ))}
                        {searchResults.length > 5 && (
                          <div className="search-result-more">
                            +{searchResults.length - 5} more results
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {mode === 'group' && (
                    <button
                      className="modal-create-btn"
                      onClick={handleSubmit}
                      disabled={!recipientInput.trim()}
                      style={{ flexShrink: 0 }}
                    >
                      Add member
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {mode === 'dm' && (
          <div className="modal-footer">
            <button
              className="modal-create-btn"
              onClick={handleSubmit}
              disabled={!recipientInput.trim()}
            >
              Create
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default NewConversationModal;
