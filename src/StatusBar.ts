import { Menu, Notice, setIcon } from "obsidian";
import Whisper from "main";
import {
	applyAudioDeviceSelection,
	listInputDevices,
} from "./audioDevices";
import { showMenuAboveAnchor } from "./menuPosition";
import {
	getModuleById,
	getNextTranscriptionProvider,
} from "./transcribers/registry";

export enum RecordingStatus {
	Idle = "idle",
	Recording = "recording",
	Paused = "paused",
	Processing = "processing",
}

const HOVER_OPEN_DELAY_MS = 250;
const HOVER_CLOSE_DELAY_MS = 150;

export class StatusBar {
	plugin: Whisper;
	statusBarItem: HTMLElement | null = null;
	status: RecordingStatus = RecordingStatus.Idle;
	private listeners: Array<(status: RecordingStatus) => void> = [];
	private deviceLabel = "Default";
	private permissionRequested = false;
	private hoverOpenTimer: ReturnType<typeof setTimeout> | null = null;
	private hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;
	private activeMicMenu: Menu | null = null;

	constructor(plugin: Whisper) {
		this.plugin = plugin;
		this.statusBarItem = this.plugin.addStatusBarItem();
		this.statusBarItem.addClass("whisper-status-bar");
		this.statusBarItem.addEventListener("click", () => {
			void this.cycleProvider();
		});
		this.statusBarItem.addEventListener("mouseenter", () => {
			this.scheduleMicrophoneMenu();
		});
		this.statusBarItem.addEventListener("mouseleave", () => {
			this.cancelMicrophoneMenuOpen();
			this.scheduleMicrophoneMenuClose();
		});
		this.updateStatusBarItem();
		void this.refreshDeviceLabel();
	}

	onChange(listener: (status: RecordingStatus) => void): void {
		this.listeners.push(listener);
	}

	offChange(listener: (status: RecordingStatus) => void): void {
		this.listeners = this.listeners.filter((fn) => fn !== listener);
	}

	updateStatus(status: RecordingStatus) {
		this.status = status;
		this.updateStatusBarItem();
		this.listeners.forEach((fn) => fn(status));
	}

	shortLabel(label: string): string {
		const text = label || "Default";
		if (text.length <= 18) {
			return text;
		}
		return text.slice(0, 17) + "...";
	}

	combinedStatusLabel(
		providerShort: string,
		micLabel: string,
		maxLen = 28
	): string {
		const micShort = this.shortLabel(micLabel);
		const combined = `${providerShort} · ${micShort}`;
		if (combined.length <= maxLen) {
			return combined;
		}
		const prefix = `${providerShort} · `;
		const remaining = maxLen - prefix.length - 3;
		if (remaining <= 0) {
			return `${providerShort.slice(0, maxLen - 3)}...`;
		}
		return `${prefix}${micShort.slice(0, remaining)}...`;
	}

	private isRecordingOrPaused(): boolean {
		return (
			this.status === RecordingStatus.Recording ||
			this.status === RecordingStatus.Paused
		);
	}

	private cancelMicrophoneMenuOpen(): void {
		if (this.hoverOpenTimer) {
			clearTimeout(this.hoverOpenTimer);
			this.hoverOpenTimer = null;
		}
	}

	private scheduleMicrophoneMenuClose(): void {
		if (this.hoverCloseTimer) {
			clearTimeout(this.hoverCloseTimer);
		}
		this.hoverCloseTimer = setTimeout(() => {
			this.hoverCloseTimer = null;
			this.hideMicrophoneMenu();
		}, HOVER_CLOSE_DELAY_MS);
	}

	private cancelMicrophoneMenuClose(): void {
		if (this.hoverCloseTimer) {
			clearTimeout(this.hoverCloseTimer);
			this.hoverCloseTimer = null;
		}
	}

	private hideMicrophoneMenu(): void {
		if (this.activeMicMenu) {
			this.activeMicMenu.hide();
			this.activeMicMenu = null;
		}
	}

	private scheduleMicrophoneMenu(): void {
		this.cancelMicrophoneMenuClose();
		if (this.hoverOpenTimer || this.activeMicMenu) {
			return;
		}
		this.hoverOpenTimer = setTimeout(() => {
			this.hoverOpenTimer = null;
			void this.showMicrophoneMenu();
		}, HOVER_OPEN_DELAY_MS);
	}

	private async ensureMicrophonePermission(): Promise<void> {
		if (this.permissionRequested) {
			return;
		}
		this.permissionRequested = true;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			stream.getTracks().forEach((track) => track.stop());
		} catch (err) {
			console.log(
				"Microphone permission not granted, device labels may be limited"
			);
		}
	}

	async refreshDeviceLabel(): Promise<void> {
		const devices = await listInputDevices();
		const currentId = this.plugin.settings.audioDeviceId || "default";
		const match = devices.find((d) => d.id === currentId);
		if (match) {
			this.deviceLabel = match.label;
		} else {
			this.deviceLabel = "Default";
			const hasRealIds = devices.some(
				(d) => d.id && d.id !== "default"
			);
			if (hasRealIds && currentId !== "default") {
				await applyAudioDeviceSelection(this.plugin, "default");
			}
		}
		this.updateStatusBarItem();
	}

	async cycleProvider(): Promise<void> {
		if (this.isRecordingOrPaused()) {
			new Notice("Provider changes on the next recording");
			return;
		}
		const next = getNextTranscriptionProvider(
			this.plugin.settings.transcriptionProvider
		);
		this.plugin.settings.transcriptionProvider = next;
		await this.plugin.settingsManager.saveSettings(this.plugin.settings);
		this.updateStatusBarItem();
		new Notice(getModuleById(next).label);
	}

	async cycleDevice(): Promise<void> {
		if (this.isRecordingOrPaused()) {
			new Notice("Microphone changes on the next recording");
			return;
		}
		await this.ensureMicrophonePermission();
		const devices = await listInputDevices();
		let currentId = this.plugin.settings.audioDeviceId || "default";
		if (!devices.some((d) => d.id === currentId)) {
			currentId = "default";
		}
		const idx = devices.findIndex((d) => d.id === currentId);
		const next = devices[(idx < 0 ? 0 : idx + 1) % devices.length];
		await applyAudioDeviceSelection(this.plugin, next.id);
		this.deviceLabel = next.label;
		this.updateStatusBarItem();
		new Notice(next.label);
	}

	private async showMicrophoneMenu(): Promise<void> {
		if (!this.statusBarItem) {
			return;
		}
		await this.ensureMicrophonePermission();
		const devices = await listInputDevices();
		const currentId = this.plugin.settings.audioDeviceId || "default";
		const menu = new Menu();
		this.activeMicMenu = menu;
		menu.onHide(() => {
			if (this.activeMicMenu === menu) {
				this.activeMicMenu = null;
			}
		});

		for (const device of devices) {
			menu.addItem((item) => {
				item.setTitle(device.label)
					.setChecked(device.id === currentId)
					.onClick(async () => {
						if (this.isRecordingOrPaused()) {
							new Notice(
								"Microphone changes on the next recording"
							);
							return;
						}
						await applyAudioDeviceSelection(
							this.plugin,
							device.id
						);
						this.deviceLabel = device.label;
						this.updateStatusBarItem();
						new Notice(device.label);
					});
			});
		}

		showMenuAboveAnchor(menu, this.statusBarItem);
		const menuEl = document.body.querySelector(".menu") as HTMLElement | null;
		if (menuEl) {
			menuEl.addEventListener("mouseenter", () => {
				this.cancelMicrophoneMenuClose();
			});
			menuEl.addEventListener("mouseleave", () => {
				this.scheduleMicrophoneMenuClose();
			});
		}
	}

	updateStatusBarItem() {
		if (!this.statusBarItem) {
			return;
		}
		const module = getModuleById(this.plugin.settings.transcriptionProvider);
		const micFull = this.deviceLabel || "Default";
		const core = this.combinedStatusLabel(
			module.statusBarLabel,
			micFull
		);
		const isRecording = this.status === RecordingStatus.Recording;
		let text = core;
		let color: string | null = "green";
		switch (this.status) {
			case RecordingStatus.Recording:
				text = `Recording · ${core}`;
				color = null; // CSS owns soft red + pulse
				break;
			case RecordingStatus.Paused:
				text = `Paused · ${core}`;
				color = "yellow";
				break;
			case RecordingStatus.Processing:
				text = `Processing · ${core}`;
				color = "gray";
				break;
			case RecordingStatus.Idle:
			default:
				text = core;
				color = "green";
				break;
		}
		const tooltip = `${module.label} — ${micFull}\nClick to cycle provider · Hover for microphone`;
		this.statusBarItem.empty();
		this.statusBarItem.toggleClass(
			"whisper-status-bar--recording",
			isRecording
		);
		if (color) {
			this.statusBarItem.style.color = color;
		} else {
			this.statusBarItem.style.removeProperty("color");
		}
		setIcon(this.statusBarItem, "mic");
		this.statusBarItem.appendText(text);
		this.statusBarItem.setAttribute("title", tooltip);
		this.statusBarItem.setAttribute("aria-label", tooltip);
	}

	remove() {
		this.cancelMicrophoneMenuOpen();
		this.cancelMicrophoneMenuClose();
		this.hideMicrophoneMenu();
		if (this.statusBarItem) {
			this.statusBarItem.remove();
		}
	}
}
