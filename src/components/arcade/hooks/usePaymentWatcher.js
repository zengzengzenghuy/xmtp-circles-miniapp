import { useEffect, useState } from "react";
import { checkPaymentReceived } from "../payments/circles.js";

function isTransientPaymentError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("timeout") ||
    message.includes("aborted") ||
    message.includes("http 408") ||
    message.includes("http 425") ||
    message.includes("http 429") ||
    message.includes("http 500") ||
    message.includes("http 502") ||
    message.includes("http 503") ||
    message.includes("http 504")
  );
}

export function usePaymentWatcher({
  enabled,
  rpcUrl,
  dataValue,
  minAmountCRC,
  recipientAddress,
  intervalMs = 5000,
}) {
  const [status, setStatus] = useState("idle");
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setPayment(null);
    setError("");

    if (!enabled || !rpcUrl || !dataValue || !minAmountCRC || !recipientAddress) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let timeoutId = null;

    const poll = async () => {
      if (cancelled) {
        return;
      }

      setStatus((current) => (current === "confirmed" ? current : "waiting"));

      try {
        const found = await checkPaymentReceived(
          rpcUrl,
          dataValue,
          minAmountCRC,
          recipientAddress,
        );

        if (cancelled) {
          return;
        }

        if (found) {
          setPayment(found);
          setStatus("confirmed");
          return;
        }
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        const nextMessage =
          nextError instanceof Error ? nextError.message : "Payment check failed";

        if (isTransientPaymentError(nextError)) {
          setError("Circles RPC is temporarily unavailable. Retrying automatically.");
          setStatus("waiting");
          timeoutId = window.setTimeout(poll, intervalMs);
          return;
        }

        setError(nextMessage);
        setStatus("error");
        return;
      }

      setError("");
      timeoutId = window.setTimeout(poll, intervalMs);
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [enabled, rpcUrl, dataValue, minAmountCRC, recipientAddress, intervalMs]);

  return { status, payment, error };
}
