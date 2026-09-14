const TRUSTED_WATCH_DISCLOSURE_ORIGINS = new Set([
  'https://www.youtube.com',
  'https://music.youtube.com',
]);

interface RuntimeMessageSender {
  id?: string;
  url?: string;
}

export function isTrustedWatchDisclosureSender(
  sender: RuntimeMessageSender,
  extensionId: string,
): boolean {
  if (sender.id !== extensionId || sender.url === undefined) {
    return false;
  }

  try {
    return TRUSTED_WATCH_DISCLOSURE_ORIGINS.has(new URL(sender.url).origin);
  } catch {
    return false;
  }
}
