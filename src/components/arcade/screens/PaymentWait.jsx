import React from "react";

export default function PaymentWait({
  selectedGame,
  payment,
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
          {selectedGame?.label || "this session"}. We&apos;ll keep checking in
          the background.
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
    </div>
  );
}
