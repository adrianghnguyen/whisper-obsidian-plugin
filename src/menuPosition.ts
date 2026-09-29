import type { Menu } from "obsidian";

const MENU_SELECTOR = ".menu";

function placeAbove(
	menuEl: HTMLElement,
	anchorRect: DOMRect,
	gap: number
): void {
	const menuHeight = menuEl.offsetHeight;
	const top = Math.max(8, anchorRect.top - menuHeight - gap);
	menuEl.style.top = `${top}px`;
	const left = Math.min(
		anchorRect.left,
		window.innerWidth - menuEl.offsetWidth - 8
	);
	menuEl.style.left = `${Math.max(8, left)}px`;
}

/**
 * Show a non-native menu directly above an anchor element.
 *
 * Resolves with the rendered `.menu` element (after one animation frame, when
 * layout is measurable) so callers can stack a second popover on top of it.
 * When more than one menu is already open, only the newly created element is
 * repositioned, matched by diffing the menu set before/after showing.
 */
export function showMenuAboveAnchor(
	menu: Menu,
	anchor: HTMLElement,
	gap = 4
): Promise<HTMLElement | null> {
	menu.setUseNativeMenu(false);
	const before = new Set(
		Array.from(document.body.querySelectorAll(MENU_SELECTOR))
	);
	const anchorRect = anchor.getBoundingClientRect();
	menu.showAtPosition({ x: anchorRect.left, y: anchorRect.top, overlap: true });

	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			const after = Array.from(
				document.body.querySelectorAll(MENU_SELECTOR)
			);
			const menuEl = (after.find((el) => !before.has(el)) ??
				after[after.length - 1]) as HTMLElement | undefined;
			if (menuEl) {
				placeAbove(menuEl, anchorRect, gap);
			}
			resolve(menuEl ?? null);
		});
	});
}