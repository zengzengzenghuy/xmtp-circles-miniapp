import React from "react";
import { getPieceById, getRotatedPieceCells, normalizeCells } from "../helpers/pieces.js";

export default function PieceShape({
  piece,
  pieceId,
  rotation = 0,
  gridClassName = "piece-card-shape-grid",
  cellClassName = "piece-card-shape-cell",
  filledCellClassName = "piece-card-shape-cell-filled",
}) {
  const resolvedPiece = piece || getPieceById(pieceId);
  if (!resolvedPiece) {
    return null;
  }

  const cells = piece
    ? normalizeCells(resolvedPiece.cells)
    : getRotatedPieceCells(resolvedPiece.id, rotation);
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  const filled = new Set(cells.map(([x, y]) => `${x}:${y}`));

  return (
    <div
      className={gridClassName}
      style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
      aria-hidden="true"
    >
      {Array.from({ length: width * height }, (_, index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        return (
          <span
            key={`${resolvedPiece.id}-${rotation}-${x}-${y}`}
            className={`${cellClassName} ${filled.has(`${x}:${y}`) ? filledCellClassName : ""}`.trim()}
          />
        );
      })}
    </div>
  );
}
