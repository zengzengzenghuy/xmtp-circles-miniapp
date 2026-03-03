import React from "react";

export default function PaymentSelect({
  actor,
  selectedGame,
  billing,
  recipientAddress,
  configError,
  onCreatorHalf,
  onCreatorFull,
  onJoinerPay,
  onJoinerFree,
  onBack,
}) {
  const isCreator = actor === "creator";
  const payDisabledReason = configError ? configError : "";

  return (
    <div className="screen screen-stack-tight">
      <section className="panel section-intro">
        <p className="eyebrow">Payment</p>
        <h2>
          {isCreator
            ? "Choose how you want to fund this session."
            : "This session supports an optional contribution."}
        </h2>
        <p className="muted">
          {isCreator
            ? `Paid mode is enabled for ${selectedGame?.label || "this game"}. You will be redirected to the Gnosis transfer flow before setup unlocks.`
            : `The creator selected a paid session for ${selectedGame?.label || "this game"}. You can contribute 1 CRC or join for free.`}
        </p>
      </section>

      <div className="panel panel-muted">
        <p className="eyebrow">Recipient organization</p>
        <code>{recipientAddress || "Not configured"}</code>
        {!isCreator && billing?.creatorFeeCrc ? (
          <p className="muted">
            Creator contribution: {billing.creatorFeeCrc} CRC
          </p>
        ) : null}
      </div>

      {payDisabledReason ? (
        <div className="banner error">{payDisabledReason}</div>
      ) : null}

      <div className="panel action-stack">
        {isCreator ? (
          <>
            <button
              type="button"
              className="primary-btn full-width-mobile"
              disabled={Boolean(payDisabledReason)}
              onClick={onCreatorHalf}
            >
              1 CRC pay half fee
            </button>
            <button
              type="button"
              className="secondary-btn full-width-mobile"
              disabled={Boolean(payDisabledReason)}
              onClick={onCreatorFull}
            >
              2 CRC pay full fee
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="primary-btn full-width-mobile"
              disabled={Boolean(payDisabledReason)}
              onClick={onJoinerPay}
            >
              Pay 1 CRC
            </button>
            <button
              type="button"
              className="secondary-btn full-width-mobile"
              onClick={onJoinerFree}
            >
              Play for free
            </button>
          </>
        )}
      </div>

      {onBack ? (
        <button
          type="button"
          className="ghost-btn full-width-mobile"
          onClick={onBack}
        >
          Back
        </button>
      ) : null}
    </div>
  );
}
