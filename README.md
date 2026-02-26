# XMTP Circles Mini App

A fully-functional XMTP chat application with integrated wallet connection, real-time messaging, and Circles integration capabilities.

## Setup

### Prerequisites

- Node.js 16+ and npm
- A Web3 wallet (MetaMask or WalletConnect-compatible)
- WalletConnect Project ID (free from [cloud.walletconnect.com](https://cloud.walletconnect.com/))

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Create environment file:**

```bash
cp .env.example .env
```

3. **Configure WalletConnect:**
   - Get a Project ID from [https://cloud.walletconnect.com/](https://cloud.walletconnect.com/)
   - Add it to `.env`:
   ```
   VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
   ```

### Development

Run the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5182`

### Building for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Getting Started

### How to Use

1. **Connect Wallet**
   - Click the **Account** tab at the bottom
   - Click **Connect** tab
   - Choose MetaMask or WalletConnect
   - Approve the connection in your wallet

2. **Create XMTP Inbox**
   - After wallet connection, click **Connect to XMTP**
   - Sign the message in your wallet to create your XMTP identity
   - Your inbox ID will be saved automatically

3. **Start a Conversation**
   - Go to the **Chat** tab
   - Click the **+** button
   - Enter a recipient's Ethereum address (must be XMTP-enabled)
   - Send your first message

4. **Configure Settings**
   - Go to **Account** tab → **Settings** tab
   - Toggle **Circles mode** to enable Circles integration features (WIP)

### Browser Compatibility

**Recommended Browsers**: Chrome, Firefox, Edge

**Brave Users**: Not available, Brave blocks xmtp from storing database in OPFS.

## Data Storage & Privacy

### Local Storage

The app stores the following data locally in your browser:

- **XMTP Inbox ID**: Mapped to your wallet address (`xmtp-inbox-{address}`)

### IndexedDB

XMTP Browser SDK uses IndexedDB to store:

- Conversation data
- Message history
- Encryption keys
- Member information

### Privacy

- All data is stored locally in your browser
- No data is sent to external servers (except XMTP network nodes)
- Messages are end-to-end encrypted via XMTP protocol
- Clearing browser data will reset your local state (inbox ID can be recovered by reconnecting)

## Architecture

### Core Files

- **`src/App.jsx`** - Main application with XMTP client management, conversation syncing, and tab navigation
- **`src/config/wagmi.js`** - Wagmi configuration for Gnosis Chain
- **`src/main.jsx`** - App entry point with WagmiProvider and QueryClientProvider

### Components

- **`src/components/AccountPage.jsx`** - Wallet connection and XMTP inbox management with Settings tab
- **`src/components/ConversationList.jsx`** - Conversation list with refresh and new conversation buttons
- **`src/components/MessageArea.jsx`** - Message display, filtering, and sending
- **`src/components/BottomTabs.jsx`** - Bottom navigation for Chat and Account tabs
- **`src/components/NewConversationModal.jsx`** - Modal for creating new conversations

### State Management

- **`src/stores/inboxStore.js`** - Zustand store for conversations, messages, and metadata
- **`src/stores/inboxHooks.js`** - Custom hooks for accessing store state

### Custom Hooks

- **`src/hooks/useConversations.js`** - Conversation management (sync, create, stream)
- **`src/hooks/useConversation.js`** - Individual conversation operations (messages, send)

### Helpers

- **`src/helpers/createSigner.js`** - EOA signer creation for XMTP

### Styling

- **`src/styles.css`** - Complete application styling with responsive design

## Technical Details

### State Management

- **Zustand** for global state management
- **localStorage** for persistence of inbox IDs and settings
- Efficient message and conversation caching

### XMTP Integration

- **Environment**: Dev network
- **Storage**: IndexedDB for XMTP data
- **Streaming**: Real-time conversation and message updates
- **Members**: Extracts Ethereum addresses from member accountIdentifiers

### Message Handling

- Filters system messages (membership updates, etc.)
- Displays only user-sent text messages
- Shows timestamps in local time
- Proper sent/received styling

## Troubleshooting

### Connection Issues

**"Client.create timed out!"**

- Disable browser privacy shields/ad blockers for this site
- Try a different browser (Chrome/Firefox recommended)
- Check that IndexedDB is enabled in browser settings
- Clear browser cache and try again

**"Failed to load XMTP client"**

- Your browser may be blocking IndexedDB access
- Try disabling browser extensions temporarily
- Ensure you're not in private/incognito mode

**"Address not registered on XMTP network"**

- The recipient must have created an XMTP inbox first
- Ask them to connect to any XMTP app (like xmtp.chat) once
- Check that you entered the correct Ethereum address

### Message Issues

**Messages not appearing**

- Click the refresh button (↻) in the conversation list
- Check browser console for errors
- Verify you're connected to the same network (dev)

**Cannot send messages**

- Ensure your wallet is still connected
- Check that you have an active XMTP inbox
- Verify the conversation is active

## Known Issues

- **Connection Timeout**: 60-second timeout for XMTP client creation
- **System Messages**: Automatically filtered but visible in network logs
- **First Message Delay**: Initial message in a new conversation may take a few seconds

## Roadmap

- [ ] Circles integration features
  - [ ] Transfer CRC with Notes
  - [ ] Only allow conversation with human / avatar you trust
  - [ ] Circles as identifier ID
  - [ ] Search Circles profile
- [ ] XMTP Group chat support
- [ ] Circles group chat support
- [ ] Compatible with Circles MiniApp

## Resources

- [XMTP Documentation](https://docs.xmtp.org/)
- [XMTP Browser SDK](https://github.com/xmtp/xmtp-js)
- [wagmi Documentation](https://wagmi.sh/)
