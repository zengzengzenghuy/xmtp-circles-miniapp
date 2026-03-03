import React from 'react';

export default function SegmentedTabs({
  items = [],
  value,
  onChange,
  size = 'md',
  tone = 'soft',
  className = '',
}) {
  const classes = ['segmented-tabs', `segmented-tabs-${size}`, `segmented-tabs-${tone}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="tablist">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented-tab ${active ? 'segmented-tab-active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            <span>{item.label}</span>
            {item.hasDot ? <span className="segmented-tab-dot" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
