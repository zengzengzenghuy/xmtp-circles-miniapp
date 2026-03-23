import React, { useState, useEffect, useRef } from 'react';

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function NewConversationModal({ isOpen, onClose, onCreateConversation }) {
  const [mode, setMode] = useState('dm'); // 'dm' by default (group mode hidden)
  const [recipientInput, setRecipientInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [groupMembers, setGroupMembers] = useState([]);
  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setMode('dm');
      setRecipientInput('');
      setSearchResults([]);
      setIsSearching(false);
      setIsSubmitting(false);
      setSubmitError('');
      setSelectedIndex(-1);
      setGroupMembers([]);
    } else {
      // Focus input after mount
      setTimeout(() => inputRef.current?.focus(), 100);
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

    // Keep search responsive without spamming the API.
    searchTimeoutRef.current = setTimeout(() => {
      searchCirclesProfiles(recipientInput);
    }, 350);

    // Cleanup on unmount or when input changes
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [recipientInput]);

  const submitRecipient = async (value) => {
    const normalized = value.trim();

    if (!normalized) {
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      await onCreateConversation(normalized);
      setRecipientInput('');
      setSearchResults([]);
      onClose();
    } catch (error) {
      setSubmitError(error.message || 'Failed to start conversation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectResult = async (address) => {
    if (mode === 'group') {
      handleAddMember(address);
    } else {
      await submitRecipient(address);
    }
  };

  const handleSubmit = async () => {
    const trimmedRecipient = recipientInput.trim();
    if (!trimmedRecipient) {
      return;
    }

    if (mode === 'group') {
      handleAddMember(trimmedRecipient);
      return;
    }

    if (ADDRESS_PATTERN.test(trimmedRecipient)) {
      await submitRecipient(trimmedRecipient);
      return;
    }

    if (searchResults.length === 1) {
      await submitRecipient(searchResults[0].address);
      return;
    }

    setSubmitError('Select a profile from the list or paste a full 0x address.');
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
          void handleSelectResult(searchResults[selectedIndex].address);
        } else {
          void handleSubmit();
        }
        return;
      }
    } else {
      // No dropdown - standard behavior
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleSubmit();
      }
    }

    if (e.key === 'Escape') {
      if (searchResults.length > 0) {
        setSearchResults([]);
        setSelectedIndex(-1);
      } else if (!isSubmitting) {
        onClose();
      }
    }
  };

  const handleInputChange = (e) => {
    setRecipientInput(e.target.value);
    if (submitError) {
      setSubmitError('');
    }
    setSelectedIndex(-1); // Reset selection when typing
  };

  if (!isOpen) return null;

  return (
    <div className="new-msg-overlay" onClick={() => !isSubmitting && onClose()}>
      <div className="new-msg-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header with back + title */}
        <div className="new-msg-header">
          <button className="new-msg-back" onClick={onClose} aria-label="Back" disabled={isSubmitting}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="new-msg-title">New Message</h3>
          <button
            className="new-msg-go"
            onClick={handleSubmit}
            disabled={!recipientInput.trim() || isSubmitting}>
            {isSubmitting ? 'Opening…' : 'Go'}
          </button>
        </div>

        {/* Search input */}
        <div className="new-msg-search">
          <span className="new-msg-to">To:</span>
          <input
            ref={inputRef}
            type="text"
            className="new-msg-input"
            placeholder="Name or 0x address..."
            value={recipientInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          {isSearching && <span className="new-msg-spinner">Searching…</span>}
        </div>
        {submitError && <div className="new-msg-error">{submitError}</div>}

        {/* Results list - scrollable area */}
        <div className="new-msg-results">
          {searchResults.length > 0 ? (
            searchResults.map((result, index) => (
              <div
                key={result.address}
                className={`new-msg-result-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelectResult(result.address)}
                onMouseEnter={() => setSelectedIndex(index)}>
                <div className="new-msg-result-avatar">
                  {result.name ? result.name.slice(0, 2).toUpperCase() : '??'}
                </div>
                <div className="new-msg-result-info">
                  <div className="new-msg-result-name">{result.name}</div>
                  <div className="new-msg-result-addr">
                    {result.address.slice(0, 6)}...{result.address.slice(-4)}
                  </div>
                </div>
              </div>
            ))
          ) : recipientInput.length >= 2 && !isSearching && !recipientInput.startsWith('0x') ? (
            <div className="new-msg-empty">No results found</div>
          ) : !recipientInput ? (
            <div className="new-msg-empty">Search for a name or paste an address</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default NewConversationModal;
