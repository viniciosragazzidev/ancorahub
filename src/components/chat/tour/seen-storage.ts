/**
 * "Already seen" marks of tours, welcome cards and first steps.
 *
 * While a super admin is seeing the app as someone else ("Ver como", the banner
 * sets <html data-view-as="1">), nothing is remembered on the device for good:
 * marks live in sessionStorage under their own prefix, so the admin is not
 * nagged twice in the same session and the real user still gets every tour on
 * their own first access.
 */
export function isViewingAs() {
  return typeof document !== "undefined" && document.documentElement.dataset.viewAs === "1";
}

function storage(): Storage {
  return isViewingAs() ? window.sessionStorage : window.localStorage;
}

const scoped = (key: string) => (isViewingAs() ? `view-as:${key}` : key);

export function readSeen(key: string): string | null {
  try {
    return storage().getItem(scoped(key));
  } catch {
    return null;
  }
}

export function writeSeen(key: string, value: string) {
  try {
    storage().setItem(scoped(key), value);
  } catch {
    /* private mode: the mark lasts only for this visit */
  }
}
