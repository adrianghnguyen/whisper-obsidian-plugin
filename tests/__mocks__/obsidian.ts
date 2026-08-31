function createElement(tag: string): HTMLElement {
	if (typeof document !== "undefined") {
		return document.createElement(tag);
	}

	const children: HTMLElement[] = [];
	const el = {
		tagName: tag.toUpperCase(),
		attributes: {} as Record<string, string>,
		children,
		setAttribute(name: string, value: string) {
			this.attributes[name] = value;
		},
		getAttribute(name: string) {
			return this.attributes[name] ?? null;
		},
		appendChild(child: HTMLElement) {
			children.push(child);
			return child;
		},
		empty() {
			children.length = 0;
		},
		querySelectorAll(selector: string) {
			const matches: HTMLElement[] = [];
			const walk = (node: {
				attributes?: Record<string, string>;
				children?: HTMLElement[];
			}) => {
				if (
					selector === "[data-whisper-secret-component]" &&
					node.attributes?.["data-whisper-secret-component"] === "true"
				) {
					matches.push(node as unknown as HTMLElement);
				}
				for (const child of node.children ?? []) {
					walk(
						child as unknown as {
							attributes?: Record<string, string>;
							children?: HTMLElement[];
						}
					);
				}
			};
			walk({ children });
			return matches;
		},
		scrollTop: 0,
		classList: { add: () => {} },
	} as unknown as HTMLElement;

	return el;
}

// Minimal Obsidian API mocks for testing

export class Plugin {
	app: any = {
		loadLocalStorage: (_key: string) => null,
		saveLocalStorage: (_key: string, _value: string) => {},
		secretStorage: {
			getSecret: (_id: string) => "",
			setSecret: (_id: string, _value: string) => {},
			deleteSecret: (_id: string) => {},
		},
	};
	addStatusBarItem() {
		return createElement("div");
	}
	addCommand(_cmd: any) {}
	addRibbonIcon(_icon: string, _title: string, _cb: any) {}
	addSettingTab(_tab: any) {}
	async loadData() {
		return {};
	}
	async saveData(_data: any) {}
}

export class Modal {
	app: any;
	containerEl = createElement("div");
	contentEl = createElement("div");
	constructor(app: any) {
		this.app = app;
	}
	open() {}
	close() {}
}

export class Notice {
	message: string;
	constructor(message: string) {
		this.message = message;
	}
}

export class MarkdownView {
	editor = {
		getCursor: () => ({ line: 0, ch: 0 }),
		replaceRange: (_text: string, _pos: any) => {},
		setCursor: (_pos: any) => {},
	};
}

export class Setting {
	containerEl = createElement("div");
	constructor(public settingContainer: HTMLElement) {
		settingContainer.appendChild(this.containerEl);
	}
	setName(_n: string) {
		return this;
	}
	setDesc(_d: string) {
		return this;
	}
	addText(_cb: any) {
		return this;
	}
	addToggle(_cb: any) {
		return this;
	}
	addDropdown(_cb: any) {
		return this;
	}
	addButton(_cb: any) {
		return this;
	}
	addComponent(cb: (el: HTMLElement) => unknown) {
		const el = createElement("div");
		cb(el);
		this.containerEl.appendChild(el);
		return this;
	}
	setDisabled(_d: boolean) {
		return this;
	}
}

export class PluginSettingTab {
	app: any;
	plugin: any;
	containerEl = createElement("div");
	constructor(app: any, plugin: any) {
		this.app = app;
		this.plugin = plugin;
	}
}

export class SecretComponent {
	constructor(_app: any, public containerEl: HTMLElement) {}
	setValue(_value: string) {
		return this;
	}
	onChange(_cb: (value: string) => unknown) {
		return this;
	}
}

export class ButtonComponent {
	buttonEl = createElement("button");
	constructor(_el: HTMLElement) {}
	setIcon(_i: string) {
		return this;
	}
	setButtonText(_t: string) {
		return this;
	}
	onClick(_cb: any) {
		return this;
	}
	setDisabled(_d: boolean) {
		return this;
	}
}

export class TFolder {
	path: string = "";
}

export const Platform = {
	isDesktopApp: true,
};

export function setIcon(_el: HTMLElement, _icon: string) {}
