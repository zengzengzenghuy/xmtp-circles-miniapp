export const BLOCK_CLASH_BOARD_SIZE = 7;
export const TOTAL_BUDGET = 8;

export const PIECE_CATALOG = [
  // 2-block (cost 1)
  { id: 'domino', label: 'Domino', cost: 1, cells: [[0, 0], [1, 0]] },
  // 3-block (cost 1)
  { id: 'tri_i', label: 'I3', cost: 1, cells: [[0, 0], [1, 0], [2, 0]] },
  { id: 'tri_l', label: 'L3', cost: 1, cells: [[0, 0], [0, 1], [1, 1]] },
  // 4-block (cost 1)
  { id: 'square_o', label: 'O', cost: 1, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: 'tet_i', label: 'I4', cost: 1, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: 'tet_l', label: 'L4', cost: 1, cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { id: 'tet_j', label: 'J4', cost: 1, cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
  { id: 'tet_t', label: 'T', cost: 1, cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: 'tet_s', label: 'S', cost: 1, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { id: 'tet_z', label: 'Z', cost: 1, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  // 6-block (cost 2)
  { id: 'hex_rect', label: '3×2', cost: 2, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  { id: 'hex_l', label: 'L6', cost: 2, cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3]] },
  { id: 'hex_t', label: 'T6', cost: 2, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [1, 2]] },
  // 8-block (cost 4)
  { id: 'oct_rect', label: '4×2', cost: 4, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]] },
  { id: 'oct_cross', label: 'Cross', cost: 4, cells: [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2], [2, 2]] },
];

export const PIECE_INDEX = Object.fromEntries(PIECE_CATALOG.map((piece, index) => [piece.id, index]));

export function getPieceById(pieceId) {
  return PIECE_CATALOG.find((piece) => piece.id === pieceId) || null;
}

export function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort(([ax, ay], [bx, by]) => (ay - by) || (ax - bx));
}

export function rotateCells(cells, rotation) {
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const rotated = cells.map(([x, y]) => {
    if (normalizedRotation === 90) return [y, -x];
    if (normalizedRotation === 180) return [-x, -y];
    if (normalizedRotation === 270) return [-y, x];
    return [x, y];
  });
  return normalizeCells(rotated);
}

export function getRotatedPieceCells(pieceId, rotation = 0) {
  const piece = getPieceById(pieceId);
  if (!piece) {
    throw new Error(`Unknown piece: ${pieceId}`);
  }
  return rotateCells(piece.cells, rotation);
}

export function getPieceCost(pieceId) {
  const piece = getPieceById(pieceId);
  return piece?.cost || 1;
}

export function getLoadoutCost(pieceIds) {
  return pieceIds.reduce((sum, id) => sum + getPieceCost(id), 0);
}
