// @dev !!!!!! SHOULD BE REPLACED WITH THE NPM PKG LATER !!!!!!

/**
 * Miniapp wallet adapter — wraps the newCore host postMessage protocol.
 *
 * When the XMTP app runs inside the newCore iframe host, this module
 * provides wallet address and signing via the host's Safe SCW wallet,
 * instead of requiring a separate wagmi/MetaMask connection.
 */

let _requestCounter = 0;
const _pending = {};
let _walletListeners = [];

window.addEventListener("message", (event) => {
  const d = event.data;
  if (!d?.type) return;

  switch (d.type) {
    case "wallet_connected":
      _walletListeners.forEach((fn) => fn(d.address));
      break;

    case "wallet_disconnected":
      _walletListeners.forEach((fn) => fn(null));
      break;

    case "sign_success":
      _pending[d.requestId]?.resolve(d.signature);
      delete _pending[d.requestId];
      break;

    case "sign_rejected":
      _pending[d.requestId]?.reject(
        new Error(d.error ?? d.reason ?? "Rejected")
      );
      delete _pending[d.requestId];
      break;
  }
});

/** Returns true when running inside the newCore iframe host. */
export const isMiniappMode = () => window.parent !== window;

/** Ask the host for the current wallet state. */
export const requestMiniappAddress = () => {
  window.parent.postMessage({ type: "request_address" }, "*");
};

/**
 * Register a callback for wallet connection changes.
 * Returns an unsubscribe function.
 * @param {(address: string | null) => void} fn
 */
export const onMiniappWalletChange = (fn) => {
  _walletListeners.push(fn);
  return () => {
    _walletListeners = _walletListeners.filter((l) => l !== fn);
  };
};

/**
 * Request the host to sign a message.
 * Returns a Promise that resolves to a hex signature string.
 *
 * @param {string} message
 * @param {'erc1271' | 'raw'} [signatureType='erc1271']
 *   'erc1271' — standard EIP-191 + ERC-1271 path (default); use for XMTP and any
 *               consumer that calls isValidSignature(eip191Hash, sig).
 *   'raw'     — raw bytes path; use for the Circles auth service which calls
 *               isValidSignature(rawBytes, sig).
 * @returns {Promise<string>} hex signature
 */
export const miniappSignMessage = (message, signatureType = "erc1271") => {
  return new Promise((resolve, reject) => {
    const requestId = "req_" + ++_requestCounter;
    _pending[requestId] = { resolve, reject };
    window.parent.postMessage({ type: "sign_message", requestId, message, signatureType }, "*");
  });
};
