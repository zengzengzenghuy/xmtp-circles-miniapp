# Arcade Module

This folder contains the offchain arcade implementation used by [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/Arcade.jsx`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/Arcade.jsx).

The arcade is intentionally split into a small coordinator plus reusable submodules:

- `games/`: game-specific setup, play, result, and reducers
- `hooks/`: local state, XMTP transport, and payment polling
- `protocol/`: message envelopes, commitment hashing, move handling
- `helpers/`: constants, invite encoding, persistence, runtime config
- `payments/`: payment marker, transfer URL, Circles RPC lookup
- `screens/`: phase-level UI shells

## Scope

This arcade is:

- offchain for game state
- peer-to-peer over XMTP
- local-first for persistence and resume
- optionally gated by a Circles payment step before setup

This arcade is not:

- onchain gameplay
- escrow or prize settlement
- CRC group logic
- smart-contract match state

## High-Level Design

[`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/Arcade.jsx`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/Arcade.jsx) is the coordinator.

It owns:

- which screen is currently shown
- when a session moves from setup to invite to play to result
- when XMTP transport should connect or replay history
- when paid mode should block setup
- when to build invites and when to join them

The rest of the arcade is mostly pure logic:

- [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeState.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeState.js)
  stores the full local arcade state machine and persistence rules.
- [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeTransport.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeTransport.js)
  wraps XMTP DMs for arcade-only messaging.
- [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/protocol/shellProtocol.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/protocol/shellProtocol.js)
  applies local moves, handles incoming messages, and builds resign/game-over/reveal messages.
- [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/gameRegistry.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/gameRegistry.js)
  is the registry of supported games.

## Supported Games

Current games:

- `battleship`
- `block_clash`

Each game definition provides the same core surface:

- initial setup state
- initial game state
- local move reducer
- opponent move reducer
- optional move-result reducer
- reveal payload builder
- secret serialization for commitments

That allows the shell protocol to stay generic while the game rules remain inside each game folder.

## Screen Phases

Phase constants live in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/constants.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/constants.js).

Current phases:

- `HOME`
- `PAYMENT_SELECT`
- `PAYMENT_WAIT`
- `SETUP`
- `CREATE_INVITE`
- `JOIN_INVITE`
- `PLAYING`
- `RESULT`

The coordinator switches between these phases. The phase tree is local UI state; XMTP only carries session messages, not screen state.

## Session Model

The core session state is stored in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeState.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeState.js).

Important fields:

- `sessionId`
- `gameKey`
- `role`: `creator` or `joiner`
- `status`: `draft`, `waiting_for_join`, `waiting_for_ready`, `active`, `result`
- `creatorAddress`
- `joinerAddress`
- `creatorCommitment`
- `joinerCommitment`
- `publicConfig`
- `turn`
- `mySeq`
- `expectedOpponentSeq`
- `winner`
- `selfReady`
- `opponentReady`

The full arcade state also includes:

- `phase`
- `selectedGameKey`
- `gameSetupState`
- `gameState`
- `secretState`
- `commitment`
- `payment`
- `recovery`
- `verification`
- `info`
- `error`

## Commit / Reveal Model

Commitment helpers live in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/protocol/commitment.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/protocol/commitment.js).

The flow is:

1. Setup produces a private secret payload.
2. The secret is serialized by the game definition.
3. A commitment hash is built from that secret.
4. The commitment is shared publicly through the invite or join message.
5. At game over, each side reveals its secret.
6. The reveal is checked against the stored commitment.

This lets the session verify setup honesty at the end without any onchain escrow.

## XMTP Transport

Transport is isolated in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeTransport.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeTransport.js).

Design rules:

- arcade uses its own XMTP DM connection, not the inbox/chat store
- it resolves peer inbox ids through `fetchInboxIdByIdentifier`
- it creates or syncs a DM conversation for that peer
- it streams all messages, then filters locally by `sessionId` and `gameKey`
- it replays history after connect so refresh/reopen can recover state

Important safeguards:

- self-authored messages are filtered out
- duplicate envelopes are ignored via a stable local message key
- only arcade protocol envelopes are accepted

This is why a player's own Battleship shot should not be replayed onto their own fleet board.

## Envelope Protocol

Envelope helpers live in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/protocol/envelope.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/protocol/envelope.js).

All arcade messages use version:

```txt
arcade/v1
```

Envelope shape:

```json
{
  "version": "arcade/v1",
  "sessionId": "...",
  "gameKey": "battleship",
  "type": "BATTLESHIP_SHOT",
  "seq": 1,
  "from": "0x...",
  "payload": {}
}
```

Lifecycle message types:

- `SESSION_JOIN`
- `SESSION_READY`

Game messages are derived from the selected game definition:

- move message
- optional move-result message
- game-over message
- reveal message

## Protocol Logic

The shell protocol in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/protocol/shellProtocol.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/protocol/shellProtocol.js) handles generic game orchestration.

It is responsible for:

- building `SESSION_JOIN`
- building `SESSION_READY`
- applying a local move and converting it into outbound XMTP envelopes
- handling incoming move / move-result / game-over / reveal messages
- building resign messages
- performing verification once a reveal is received

### Sequencing

The protocol uses two counters:

- `mySeq`
- `expectedOpponentSeq`

Rules:

- every local move uses `mySeq`
- incoming move messages are ignored if `seq !== expectedOpponentSeq`
- duplicate or stale messages do not mutate game state

### Request/Response vs Fire-and-Forget

Battleship uses request/response:

- shooter sends `SHOT`
- defender responds with `SHOT_RESULT`
- turn should stay with the opponent after the result resolves

Block Clash uses fire-and-forget:

- local piece placement immediately becomes an outbound move
- no separate move-result response is required

### Resign

Resign is implemented once in the shell protocol, not per game.

When a player resigns:

- a normal `*_GAME_OVER` message is sent with `reason: "resign"`
- a reveal is sent immediately
- the result screen remains the normal result screen
- the `info` banner explains whether you resigned or the opponent resigned

## Invite Flow

Invite helpers live in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/invite.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/invite.js).

Invite format:

- base64url-encoded JSON
- stored in `?arcadeInvite=...`
- versioned with `arcade/v1`

Invite payload contains:

- `sessionId`
- `gameKey`
- `creatorAddress`
- `creatorCommitment`
- `publicConfig`
- `createdAt`

### Canonical Invite Host

Invite links do not have to use the creator's current host.

If `VITE_ARCADE_INVITE_BASE_URL` is configured, arcade invite generation uses that canonical URL as the base and appends `?arcadeInvite=...`.

Example production value:

```txt
https://circles.gnosis.io/miniapps/xmtp-circles-demo
```

If the env var is unset or invalid, arcade falls back to the current runtime URL. This keeps local development and preview deployments usable.

### Creator Free Flow

1. Pick a game on home.
2. Go to setup.
3. Commit setup.
4. Generate invite link.
5. Wait for `SESSION_JOIN`.
6. Send `SESSION_READY`.
7. Enter play.

### Joiner Free Flow

1. Open invite link.
2. Arcade parses `arcadeInvite`.
3. Setup is initialized from invite metadata.
4. Joiner commits setup.
5. Joiner sends `SESSION_JOIN`.
6. Wait for `SESSION_READY`.
7. Enter play.

## Payment Mode

Runtime config lives in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/config.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/config.js).

Supported env vars:

```env
VITE_ARCADE_FREE_MODE=true
VITE_ARCADE_INVITE_BASE_URL=https://circles.gnosis.io/miniapps/xmtp-circles-demo
VITE_ARCADE_PAYMENT_RECIPIENT_ADDRESS=0x8132139D4ec3f68Cd3eddE9baF9d2137edca5849
VITE_CIRCLES_RPC_URL=https://rpc.aboutcircles.com/
VITE_GNOSIS_TRANSFER_BASE_URL=https://app.gnosis.io
VITE_ARCADE_PAYMENT_POLL_INTERVAL_MS=5000
```

### Free Mode

If `VITE_ARCADE_FREE_MODE=true`, arcade behaves like a pure offchain game flow and skips payment entirely.

### Paid Mode

If `VITE_ARCADE_FREE_MODE=false`, payment gates setup:

- creator must pay before setup unlocks
- invitee can pay `1 CRC` or play for free

Payment state is stored in `state.payment`.

Important fields:

- `mode`
- `actor`
- `selection`
- `amountCrc`
- `marker`
- `watchStatus`
- `confirmedPayment`
- `error`

### Creator Paid Flow

1. Select game on home.
2. Enter `PAYMENT_SELECT`.
3. Choose:
   - `1 CRC pay half fee`
   - `2 CRC pay full fee`
4. Arcade creates a session id first.
5. Arcade builds a payment marker tied to that session.
6. Arcade opens the Gnosis transfer URL.
7. Arcade enters `PAYMENT_WAIT`.
8. After confirmation, setup unlocks.
9. Invite payload includes billing metadata under `publicConfig.billing`.

### Invitee Paid Flow

If invite billing is `paid`, the joiner does not go straight to setup.

They see:

- `Pay 1 CRC`
- `Play for free`

If they pay:

- a joiner-specific payment marker is generated
- the same transfer URL pattern is used
- the app waits for confirmation before setup

If they choose free:

- setup opens immediately
- gameplay protocol remains unchanged

## Payment Marker

The payment marker is built in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/marker.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/marker.js).

Raw marker shape:

```txt
arcade/v1|<sessionId>|<payerRole>|<lowercased-address>|<amountCrc>
```

This is converted into bytes and hex, then attached to the Gnosis transfer URL as `data=...`.

## Gnosis Transfer URL

The transfer URL builder lives in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/transactions.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/transactions.js).

Current pattern:

```txt
https://app.gnosis.io/transfer/<recipient>/crc?data=<markerHex>&amount=<amountCrc>
```

The org address currently defaults to:

```txt
0x8132139D4ec3f68Cd3eddE9baF9d2137edca5849
```

## Payment Confirmation Lookup

Payment polling is in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/usePaymentWatcher.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/usePaymentWatcher.js).

The actual RPC lookup is in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/circles.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/circles.js).

This part is intentionally aligned with the starter kit approach:

- poll `circles_events`
- read `CrcV2_TransferData`
- match `event.data` against the payment marker
- support raw string, raw hex, and decoded UTF-8 matching

This is important because the Gnosis transfer URL writes marker data in a way that may not come back in exactly one normalized representation.

### Local Development RPC Proxy

On localhost, the app rewrites AboutCircles RPC traffic to the Vite proxy path:

```txt
/circles-rpc
```

The proxy is defined in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/vite.config.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/vite.config.js).

Reason:

- browser direct requests to `https://rpc.aboutcircles.com/` can fail in dev because of CORS or upstream proxy issues

### Transient RPC Errors

The watcher treats `502`, `503`, `504`, timeouts, and fetch failures as temporary.

That means:

- payment wait stays active
- the UI does not fail permanently
- polling continues automatically

## Persistence and Recovery

Persistence helpers live in [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/storage.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/storage.js).

Storage keys:

- `arcade-state/<address>/<gameKey>/<sessionId>`
- `arcade-secret/<address>/<gameKey>/<sessionId>`
- `arcade-active/<address>`

### What Is Persisted

- phase
- session state
- setup state
- game state
- secret state
- commitments
- payment state
- verification state

### Recovery Model

The arcade no longer auto-resumes directly into the last screen.

Instead:

1. stored state is loaded on mount
2. it is validated
3. if valid, it is staged as `recovery`
4. home shows a recovery panel
5. the user chooses:
   - `Resume session`
   - `Start over`

### Reset

Reset is wallet-scoped and destructive for arcade-only local state.

`clearAllArcadeStateForAddress(address)` removes:

- all saved session snapshots for that wallet
- all saved secret snapshots for that wallet
- the active session pointer for that wallet

This is the escape hatch that prevents users from getting stuck in stale setup or payment states.

## Result Verification

Result verification is driven by:

- stored commitments
- opponent reveal payload
- game-specific verification logic

The shell protocol updates `verification` in state when a reveal arrives. The result screen then surfaces whether the final state is consistent with the original committed setup.

## Current Game Notes

### Battleship

- setup is private and committed before invite/join
- moves are request/response
- creator starts
- local transport filters prevent self-echoed shots from being applied as incoming shots

### Block Clash

- board is currently `7x7`
- the setup catalog currently includes `10` piece variations
- each player selects `8` pieces for the session
- in-play piece selection uses shape cards instead of raw ids

## Important Files

- Coordinator:
  [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/Arcade.jsx`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/Arcade.jsx)
- State:
  [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeState.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeState.js)
- XMTP transport:
  [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeTransport.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/hooks/useArcadeTransport.js)
- Protocol:
  [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/protocol/shellProtocol.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/protocol/shellProtocol.js)
- Invites:
  [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/invite.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/invite.js)
- Storage:
  [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/storage.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/helpers/storage.js)
- Payments:
  [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/circles.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/circles.js)
  [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/marker.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/marker.js)
  [`/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/transactions.js`](/Users/hugser/Documents/Gnosis/repos/xmtp-circles-miniapp/src/components/arcade/payments/transactions.js)

## Debugging Notes

If you see logs for:

- `pulse.walletconnect.org`
- `mm-sdk-analytics.api.cx.metamask.io`

those are telemetry requests and not part of arcade logic.

If you see:

```txt
POST /circles-rpc 503
```

that means:

- the local proxy is being used correctly
- the upstream Circles RPC is currently unavailable

It does not mean the browser is blocked by CORS anymore.
