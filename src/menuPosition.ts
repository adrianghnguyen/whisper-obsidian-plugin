import type { Menu } from "obsidian";

const MENU_SELECTOR = ".menu";

export function showMenuAboveAnchor(
	menu: Menu,
	anchor: HTMLElement,
	gap = 4
): void {
	menu.setUseNativeMenu(false);
	const rect = anchor.getBoundingClientRect();
	menu.showAtPosition({ x: rect.left, y: rect.top, overlap: true });
	requestAnimationFrame(() => {
		const menuEl = document.body.querySelector(
			MENU_SELECTOR
		) as HTMLElement | null;
		if (!menuEl) {
			return;
		}
		const menuHeight = menuEl.offsetHeight;
		const top = Math.max(8, rect.top - menuHeight - gap);
		menuEl.style.top = `${top}px`;
		const left = Math.min(
			rect.left,
			window.innerWidth - menuEl.offsetWidth - 8
		);
		menuEl.style.left = `${Math.max(8, left)}px`;
	});
}
