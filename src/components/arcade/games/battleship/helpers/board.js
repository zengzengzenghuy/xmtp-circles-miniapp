import { keccak256 } from "viem";

export const BOARD_SIZE = 10;
export const BOARD_CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const TOTAL_SHIP_CELLS = 17;

export const FLEET = [
  { id: 1, name: 'Carrier', length: 5 },
  { id: 2, name: 'Battleship', length: 4 },
  { id: 3, name: 'Cruiser', length: 3 },
  { id: 4, name: 'Submarine', length: 3 },
  { id: 5, name: 'Destroyer', length: 2 },
];

export function createEmptyBoard() {
  return Array(BOARD_CELL_COUNT).fill(0);
}

export function indexFromCoord(x, y) {
  return y * BOARD_SIZE + x;
}

export function coordFromIndex(index) {
  return {
    x: index % BOARD_SIZE,
    y: Math.floor(index / BOARD_SIZE),
  };
}

export function getShipById(shipId) {
  return FLEET.find((ship) => ship.id === shipId) || null;
}

export function getPlacedShipIds(board) {
  const seen = new Set();
  board.forEach((value) => {
    if (value > 0) seen.add(value);
  });
  return Array.from(seen).sort((left, right) => left - right);
}

export function getRemainingShips(board) {
  const placed = new Set(getPlacedShipIds(board));
  return FLEET.filter((ship) => !placed.has(ship.id));
}

export function getShipCells(board, shipId) {
  const cells = [];
  board.forEach((value, index) => {
    if (value === shipId) {
      cells.push(coordFromIndex(index));
    }
  });
  return cells;
}

export function canPlaceShip(board, ship, x, y, orientation) {
  if (!ship) return false;

  for (let offset = 0; offset < ship.length; offset += 1) {
    const targetX = orientation === 'horizontal' ? x + offset : x;
    const targetY = orientation === 'vertical' ? y + offset : y;
    if (targetX < 0 || targetX >= BOARD_SIZE || targetY < 0 || targetY >= BOARD_SIZE) {
      return false;
    }

    if (board[indexFromCoord(targetX, targetY)] !== 0) {
      return false;
    }
  }

  return true;
}

export function placeShip(board, ship, x, y, orientation) {
  if (!canPlaceShip(board, ship, x, y, orientation)) {
    return { board, placed: false };
  }

  const nextBoard = [...board];
  for (let offset = 0; offset < ship.length; offset += 1) {
    const targetX = orientation === 'horizontal' ? x + offset : x;
    const targetY = orientation === 'vertical' ? y + offset : y;
    nextBoard[indexFromCoord(targetX, targetY)] = ship.id;
  }

  return { board: nextBoard, placed: true };
}

export function validateBoard(board) {
  if (!Array.isArray(board) || board.length !== BOARD_CELL_COUNT) {
    return { valid: false, error: 'Board must contain exactly 100 cells' };
  }

  const counts = new Map();

  for (const cell of board) {
    if (!Number.isInteger(cell) || cell < 0 || cell > 5) {
      return { valid: false, error: 'Board contains invalid cell values' };
    }
    if (cell > 0) {
      counts.set(cell, (counts.get(cell) || 0) + 1);
    }
  }

  for (const ship of FLEET) {
    if ((counts.get(ship.id) || 0) !== ship.length) {
      return { valid: false, error: `${ship.name} is missing or malformed` };
    }

    const cells = getShipCells(board, ship.id);
    const xs = [...new Set(cells.map((cell) => cell.x))];
    const ys = [...new Set(cells.map((cell) => cell.y))];
    const indices = cells
      .map((cell) => (xs.length === 1 ? cell.y : cell.x))
      .sort((left, right) => left - right);
    const contiguous = indices.every((value, index) => index === 0 || value === indices[index - 1] + 1);

    if (!((xs.length === 1 || ys.length === 1) && contiguous)) {
      return { valid: false, error: `${ship.name} must be straight and contiguous` };
    }
  }

  if (board.filter((cell) => cell > 0).length !== TOTAL_SHIP_CELLS) {
    return { valid: false, error: 'Board must contain all 17 ship cells' };
  }

  return { valid: true, error: '' };
}

export function generateSalt() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function normalizeHex(value, bytes) {
  const stripped = String(value || '').replace(/^0x/, '');
  return `0x${stripped.padStart(bytes * 2, '0')}`;
}

export function hexToBytes(value) {
  const hex = String(value || '').replace(/^0x/, '');
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have an even length');
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes) {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function boardToBytes(board) {
  return Uint8Array.from(board);
}

export function computeBoardCommitment(board, salt) {
  const validation = validateBoard(board);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const boardBytes = boardToBytes(board);
  const saltBytes = hexToBytes(normalizeHex(salt, 32));
  const payload = new Uint8Array(boardBytes.length + saltBytes.length);
  payload.set(boardBytes, 0);
  payload.set(saltBytes, boardBytes.length);

  return keccak256(payload);
}

export function createCommittedBoard(board) {
  const salt = generateSalt();
  const hash = computeBoardCommitment(board, salt);
  return { board, salt, hash };
}

export function verifyBoardCommitment(board, salt, expectedHash) {
  try {
    return computeBoardCommitment(board, salt).toLowerCase() === String(expectedHash).toLowerCase();
  } catch (error) {
    return false;
  }
}

export function evaluateShot(board, x, y, priorShots = []) {
  const index = indexFromCoord(x, y);
  const shipId = board[index];
  const alreadyShot = priorShots.some((shot) => shot.x === x && shot.y === y);

  if (alreadyShot) {
    throw new Error('Cell has already been targeted');
  }

  const hit = shipId > 0;
  let sunkShipId = null;
  let gameOver = false;

  if (hit) {
    const shipCells = board
      .map((value, cellIndex) => ({ value, cellIndex }))
      .filter((entry) => entry.value === shipId)
      .map((entry) => coordFromIndex(entry.cellIndex));
    const shipShots = [...priorShots, { x, y }].filter((shot) =>
      shipCells.some((cell) => cell.x === shot.x && cell.y === shot.y)
    );

    if (shipShots.length === shipCells.length) {
      sunkShipId = shipId;
    }

    const totalHits = [...priorShots, { x, y }].filter((shot) => board[indexFromCoord(shot.x, shot.y)] > 0).length;
    if (totalHits === TOTAL_SHIP_CELLS) {
      gameOver = true;
    }
  }

  return { x, y, hit, sunkShipId, gameOver };
}

export function verifyShotHistoryAgainstBoard(board, receivedShots = []) {
  if (!Array.isArray(board) || board.length !== BOARD_CELL_COUNT) {
    return { valid: false, error: 'Board must contain exactly 100 cells', sunkShips: [] };
  }

  const seen = new Set();
  const sunkShips = new Set();
  let hitCount = 0;
  const orderedShots = [...receivedShots].sort((left, right) => (left.seq || 0) - (right.seq || 0));

  for (const shot of orderedShots) {
    const key = `${shot.x}:${shot.y}`;
    if (seen.has(key)) {
      return { valid: false, error: 'Duplicate shot found', sunkShips: [] };
    }
    seen.add(key);

    const expected = evaluateShot(
      board,
      shot.x,
      shot.y,
      orderedShots.filter((candidate) => candidate.seq < shot.seq)
    );

    if (Boolean(shot.hit) !== expected.hit) {
      return { valid: false, error: 'Hit result mismatch', sunkShips: [] };
    }

    if ((shot.sunkShipId || null) !== (expected.sunkShipId || null)) {
      return { valid: false, error: 'Sunk ship mismatch', sunkShips: [] };
    }

    if (Boolean(shot.gameOver) !== expected.gameOver) {
      return { valid: false, error: 'Game over result mismatch', sunkShips: [] };
    }

    if (shot.hit) {
      hitCount += 1;
    }
    if (shot.sunkShipId) {
      sunkShips.add(shot.sunkShipId);
    }
  }

  return {
    valid: true,
    error: '',
    sunkShips: Array.from(sunkShips).sort((left, right) => left - right),
    hitCount,
  };
}
