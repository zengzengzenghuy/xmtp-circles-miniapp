const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
});

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const isSystemMessage = (content) => {
  if (typeof content !== "object" || content === null) {
    return false;
  }

  return Boolean(
    content.addedInboxes ||
      content.removedInboxes ||
      content.initiatedByInboxId,
  );
};

export const getMessageText = (content) => {
  if (content == null) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  if (content instanceof Uint8Array) {
    return new TextDecoder().decode(content);
  }

  if (content?.content instanceof Uint8Array) {
    return new TextDecoder().decode(content.content);
  }

  if (typeof content?.content === "string") {
    return content.content;
  }

  if (isSystemMessage(content)) {
    return "";
  }

  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
};

export const isRenderableMessage = (message) => {
  return !isSystemMessage(message?.content);
};

export const formatMessageTimestamp = (sentAtNs) => {
  if (!sentAtNs) {
    return "";
  }

  return TIME_FORMATTER.format(new Date(Number(sentAtNs) / 1_000_000));
};

export const formatConversationTimestamp = (timestampNs) => {
  if (!timestampNs) {
    return "";
  }

  const date = new Date(Number(timestampNs) / 1_000_000);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / 86_400_000,
  );

  if (diffDays === 0) {
    return TIME_FORMATTER.format(date);
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return WEEKDAY_FORMATTER.format(date);
  }

  return DATE_FORMATTER.format(date);
};
