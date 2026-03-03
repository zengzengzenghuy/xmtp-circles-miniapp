import { gameDefinition as battleship } from "./games/battleship/index.js";
import { gameDefinition as blockClash } from "./games/block-clash/index.js";

export const GAMES = [battleship, blockClash];

export function getGameDefinition(gameKey) {
  return GAMES.find((game) => game.key === gameKey) || null;
}
