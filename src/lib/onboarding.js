export const WELCOME_VERSION = 'smart-este-v1';
const finishedThisSession = new Set();
export const welcomeStorageKey = (userId) => `escam.welcome.${WELCOME_VERSION}.${userId}`;

export function hasFinishedWelcome(userId, storage) {
  if (!userId) return false;
  if (finishedThisSession.has(userId)) return true;
  try { return (storage ?? window.localStorage).getItem(welcomeStorageKey(userId)) === 'done'; } catch { return false; }
}

export function finishWelcome(userId, storage) {
  if (!userId) return;
  finishedThisSession.add(userId);
  try { (storage ?? window.localStorage).setItem(welcomeStorageKey(userId), 'done'); } catch { /* Still remembered for this session. */ }
}

export function needsWelcome(user, storage) {
  return Boolean(user?.id && user.user_metadata?.smart_este_welcome_version === WELCOME_VERSION && !hasFinishedWelcome(user.id, storage));
}
