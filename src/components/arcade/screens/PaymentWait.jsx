import React from "react";

export default function PaymentWait({
  selectedGame,
  payment,
  recipientAddress,
  paymentUrl,
  status,
  info,
  error,
  onOpenPayment,
  onRetry,
}) {
  return (
    <div className="screen screen-stack-tight">
      <section className="panel section-intro">
        <p className="eyebrow">Payment pending</p>
        <h2>Complete the payment to continue.</h2>
        <p className="muted">
          Finish the {payment.amountCrc} CRC transfer for{" "}
          {selectedGame?.label || "this session"}, then return here. The app
          will keep checking the Circles RPC until the payment is found.
        </p>
      </section>

      <div className="panel-grid inline-meta-grid">
        <div className="panel">
          <p className="eyebrow">Amount</p>
          <strong>{payment.amountCrc} CRC</strong>
        </div>
        <div className="panel">
          <p className="eyebrow">Status</p>
          <strong>{status}</strong>
        </div>
      </div>

      <div className="panel panel-muted">
        <p className="eyebrow">Recipient organization</p>
        <code>{recipientAddress}</code>
      </div>

      <div className="panel panel-muted">
        <p className="eyebrow">Session marker</p>
        <code className="payment-marker-code">{payment.marker || "Pending"}</code>
      </div>

      {payment.txHashes?.length ? (
        <div className="panel panel-muted">
          <p className="eyebrow">Tx hashes</p>
          <ul className="check-list">
            {payment.txHashes.map((txHash) => (
              <li key={txHash}>
                <code>{txHash}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {info ? <div className="banner info">{info}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}

      <div className="panel action-stack">
        <button
          type="button"
          className="primary-btn full-width-mobile"
          onClick={onOpenPayment}
        >
          Open payment
        </button>
        <button
          type="button"
          className="secondary-btn full-width-mobile"
          onClick={onRetry}
        >
          Recheck payment
        </button>
      </div>

      {paymentUrl ? (
        <div className="panel panel-muted">
          <p className="eyebrow">Transfer URL</p>
          <code className="invite-link-code">{paymentUrl}</code>
        </div>
      ) : null}
    </div>
  );
}
