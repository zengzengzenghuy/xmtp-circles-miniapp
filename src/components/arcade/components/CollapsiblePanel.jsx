import React, { useEffect, useState } from 'react';

export default function CollapsiblePanel({
  title,
  summary = '',
  defaultOpen = false,
  compact = false,
  className = '',
  open,
  onToggle,
  hasDot = false,
  children,
}) {
  const controlled = open !== undefined;
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const isOpen = controlled ? open : localOpen;

  useEffect(() => {
    if (!controlled) {
      setLocalOpen(defaultOpen);
    }
  }, [controlled, defaultOpen]);

  return (
    <details
      className={`collapsible-panel ${compact ? 'collapsible-panel-compact' : ''} ${className}`.trim()}
      open={isOpen}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        if (!controlled) {
          setLocalOpen(nextOpen);
        }
        onToggle?.(nextOpen);
      }}
    >
      <summary className="collapsible-summary">
        <span className="collapsible-heading">
          <span className="eyebrow">{title}</span>
          {summary ? (
            <span className="collapsible-summary-text">
              {summary}
              {hasDot ? <span className="collapsible-summary-dot" aria-hidden="true" /> : null}
            </span>
          ) : null}
        </span>
        <span className="collapsible-indicator" aria-hidden="true" />
      </summary>
      <div className="collapsible-content">{children}</div>
    </details>
  );
}
