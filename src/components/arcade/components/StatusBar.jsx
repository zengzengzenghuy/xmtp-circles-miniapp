import React from 'react';

function labelForTurn(turn) {
  if (turn === 'creator') return 'Creator turn';
  if (turn === 'joiner') return 'Joiner turn';
  return 'Waiting for result';
}

export default function StatusBar({
  role,
  turn,
  myShots,
  opponentShots,
  opponentAddress,
  sticky = false,
  compact = false,
  variant = 'default',
}) {
  const items = [
    ...(variant === 'compact-inline' ? [] : [{ label: 'Role', value: role || 'Pending' }]),
    { label: 'Turn', value: labelForTurn(turn), emphasis: true },
    { label: 'My shots', value: myShots.length },
    { label: 'Incoming', value: opponentShots.length },
    {
      label: 'Opponent',
      value: opponentAddress ? `${opponentAddress.slice(0, 6)}...${opponentAddress.slice(-4)}` : 'Waiting',
    },
  ];

  const classes = [
    'status-bar',
    sticky ? 'status-bar-sticky' : '',
    compact ? 'status-bar-compact' : '',
    variant === 'compact-inline' ? 'status-bar-inline' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {items.map((item) => (
        <div key={item.label} className={`status-item ${item.emphasis ? 'status-item-primary' : ''}`}>
          <span className="eyebrow">{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
