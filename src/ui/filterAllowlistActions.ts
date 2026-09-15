export interface FilterAllowlistAction {
  label: string;
  onActivate(): void;
}

export interface FilterAllowlistActions {
  track?: FilterAllowlistAction;
  artist?: FilterAllowlistAction;
}

export function appendFilterAllowlistActions(
  badge: HTMLElement,
  actions: FilterAllowlistActions | undefined,
): void {
  if (actions === undefined) {
    return;
  }

  for (const action of [actions.track, actions.artist]) {
    if (action === undefined) {
      continue;
    }

    const button = badge.ownerDocument.createElement('button');
    button.className = 'noai-filter-allowlist-action';
    button.type = 'button';
    button.textContent = action.label;
    button.setAttribute('aria-label', action.label);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      action.onActivate();
    });
    badge.append(button);
  }
}
