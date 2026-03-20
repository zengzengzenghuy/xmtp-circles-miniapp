import React from "react";

export default function PaymentSelect({
  actor,
  selectedGame,
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
            ? "Choose a payment option."
            : "Choose how you want to join."}
        </h2>
        <p className="muted">
          {isCreator
            ? `${selectedGame?.label || "This game"} can use a paid entry before setup unlocks.`
            : `${selectedGame?.label || "This game"} supports an optional 1 CRC contribution.`}
        </p>
      </section>

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
              Pay 1 CRC
            </button>
            <button
              type="button"
              className="secondary-btn full-width-mobile"
              disabled={Boolean(payDisabledReason)}
              onClick={onCreatorFull}
            >
              Pay 2 CRC
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
