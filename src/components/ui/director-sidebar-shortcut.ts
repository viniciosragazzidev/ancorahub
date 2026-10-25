export const DIRECTOR_SIDEBAR_SHORTCUT = "b";

export function handleDirectorSidebarShortcut(event: KeyboardEvent, toggleSidebar: () => void) {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== DIRECTOR_SIDEBAR_SHORTCUT) return false;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ["input", "textarea", "select"].includes(target.tagName.toLowerCase()))) return false;
  event.preventDefault();
  toggleSidebar();
  return true;
}
