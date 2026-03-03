export const BLOCK_CLASH_BOARD_SIZE = 7;
export const MAX_LOADOUT_SIZE = 8;

export const PIECE_CATALOG = [
  { id: 'domino', label: 'Domino', cells: [[0, 0], [1, 0]] },
  { id: 'tri_i', label: 'I3', cells: [[0, 0], [1, 0], [2, 0]] },
  { id: 'tri_l', label: 'L3', cells: [[0, 0], [0, 1], [1, 1]] },
  { id: 'square_o', label: 'O', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: 'tet_i', label: 'I4', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: 'tet_l', label: 'L4', cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { id: 'tet_j', label: 'J4', cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
  { id: 'tet_t', label: 'T', cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: 'tet_s', label: 'S', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { id: 'tet_z', label: 'Z', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
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
