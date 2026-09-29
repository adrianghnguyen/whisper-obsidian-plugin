import { Menu, Notice, setIcon } from "obsidian";
import Whisper from "main";
import {
	applyAudioDeviceSelection,
	listInputDevices,
} from "./audioDevices";
import { showMenuAboveAnchor } from "./menuPosition";
import {
	getEnabledModules,
	getModuleById,
	getNextTranscriptionProvider,
} from "./transcribers/registry";
import {
	getNextToleranceMs,
	getToleranceFullLabel,
	getToleranceShortLabel,
} from "./transcribers/toleranceOptions";

export enum RecordingStatus {
	Idle = "idle",
	Recording = "recording",
	Paused = "paused",
	Processing = "processing",
}

const HOVER_OPEN_DELAY_MS = 400;
const HOVER_CLOSE_DELAY_MS = 150;
/* Wider budget when the tolerance segment is present so provider + tolerance +
 * microphone still fit without dropping a segment. */
const COMBINED_LABEL_MAX = 28;
const COMBINED_LABEL_MAX_WITH_TOLERANCE = 34;

export class StatusBar {
	plugin: Whisper;
	statusBarItem: HTMLElement | null = null;
	status: RecordingStatus = RecordingStatus.Idle;
	private listeners: Array<(status: RecordingStatus) => void> = [];
	private deviceLabel = "Default";
	private permissionRequested = false;
	private popoverOpenTimer: ReturnType<typeof setTimeout> | null = null;
	private popoverCloseTimer: ReturnType<typeof setTimeout> | null = null;
	private activeMicMenu: Menu | null = null;
	private activeProviderMenu: Menu | null = null;
	private micMenuAnchor: HTMLElement | null = null;
	private providerMenuAnchor: HTMLElement | null = null;

	constructor(plugin: Whisper) {
		this.plugin = plugin;
		this.statusBarItem = this.plugin.addStatusBarItem();
		this.statusBarItem.addClass("whisper-status-bar");
		this.statusBarItem.addEventListener("click", () => {
			void this.cyclePauseTolerance();
		});
		this.statusBarItem.addEventListener("mouseenter", () => {
			this.schedulePopoversOpen();
		});
		this.statusBarItem.addEventListener("mouseleave", () => {
			this.cancelPopoversOpen();
			this.schedulePopoversClose();
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
		maxLen = COMBINED_LABEL_MAX,
		toleranceShort?: string
	): string {
		const micShort = this.shortLabel(micLabel);
		const separator = " · ";
		const segments = toleranceShort
			? [providerShort, toleranceShort, micShort]
			: [providerShort, micShort];
		const combined = segments.join(separator);
		if (combined.length <= maxLen) {
			return combined;
		}

		/*
		 * Truncate the trailing microphone segment so the provider (and the
		 * optional tolerance) stay readable.
		 */
		const head = segments.slice(0, -1).join(separator);
		const remaining = maxLen - head.length - separator.length - 3;
		if (remaining <= 0) {
			if (toleranceShort) {
				return this.combinedStatusLabel(
					providerShort,
					micLabel,
					maxLen
				);
			}
			return `${providerShort.slice(0, Math.max(0, maxLen - 3))}...`;
		}
		return `${head}${separator}${segments[
			segments.length - 1
		].slice(0, remaining)}...`;
	}

	private isRecordingOrPaused(): boolean {
		return (
			this.status === RecordingStatus.Recording ||
			this.status === RecordingStatus.Paused
		);
	}

	private cancelPopoversOpen(): void {
		if (this.popoverOpenTimer) {
			clearTimeout(this.popoverOpenTimer);
			this.popoverOpenTimer = null;
		}
	}

	private schedulePopoversOpen(): void {
		this.cancelPopoversClose();
		if (this.popoverOpenTimer || this.activeProviderMenu) {
			return;
		}
		this.popoverOpenTimer = setTimeout(() => {
			this.popoverOpenTimer = null;
			void this.openPopovers();
		}, HOVER_OPEN_DELAY_MS);
	}

	private schedulePopoversClose(): void {
		if (this.popoverCloseTimer) {
			clearTimeout(this.popoverCloseTimer);
		}
		this.popoverCloseTimer = setTimeout(() => {
			this.popoverCloseTimer = null;
			this.hidePopovers();
		}, HOVER_CLOSE_DELAY_MS);
	}

	private cancelPopoversClose(): void {
		if (this.popoverCloseTimer) {
			clearTimeout(this.popoverCloseTimer);
			this.popoverCloseTimer = null;
		}
	}

	/** Wire a rendered popover so hovering it keeps both popovers alive. */
	private trackPopoverHover(menuEl: HTMLElement | null): void {
		if (!menuEl) {
			return;
		}
		menuEl.addEventListener("mouseenter", () => {
			this.cancelPopoversClose();
		});
		menuEl.addEventListener("mouseleave", () => {
			this.schedulePopoversClose();
		});
	}

	private hideMicrophoneMenu(): void {
		if (this.activeMicMenu) {
			this.activeMicMenu.hide();
			this.activeMicMenu = null;
		}
		this.micMenuAnchor = null;
	}

	private hideProviderMenu(): void {
		if (this.activeProviderMenu) {
			this.activeProviderMenu.hide();
			this.activeProviderMenu = null;
		}
		this.providerMenuAnchor = null;
	}

	private hidePopovers(): void {
		this.hideProviderMenu();
		this.hideMicrophoneMenu();
	}

	private async openPopovers(): Promise<void> {
		const micAnchor = await this.openMicrophoneMenu(this.statusBarItem);
		await this.openProviderMenu(micAnchor ?? this.statusBarItem);
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

	getDeviceLabel(): string {
		return this.deviceLabel || "Default";
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
			this.plugin.settings.transcriptionProvider,
			this.plugin.settings
		);
		this.plugin.settings.transcriptionProvider = next;
		await this.plugin.settingsManager.saveSettings(this.plugin.settings);
		this.updateStatusBarItem();
		new Notice(getModuleById(next).label);
	}

	async cyclePauseTolerance(): Promise<void> {
		if (this.isRecordingOrPaused()) {
			return;
		}
		const module = getModuleById(this.plugin.settings.transcriptionProvider);
		if (!module.supportsPauseTolerance) {
			return;
		}
		const next = getNextToleranceMs(
			this.plugin.settings.geminiLivePauseDelay
		);
		this.plugin.settings.geminiLivePauseDelay = next;
		await this.plugin.settingsManager.saveSettings(this.plugin.settings);
		this.updateStatusBarItem();
		new Notice(getToleranceFullLabel(next));
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

	async openMicrophoneMenu(
		anchor?: HTMLElement | null
	): Promise<HTMLElement | null> {
		const target = anchor ?? this.statusBarItem;
		if (!target || this.activeMicMenu) {
			return null;
		}
		await this.ensureMicrophonePermission();
		const devices = await listInputDevices();
		const currentId = this.plugin.settings.audioDeviceId || "default";
		const menu = new Menu();
		this.activeMicMenu = menu;
		menu.onHide(() => {
			if (this.activeMicMenu === menu) {
				this.activeMicMenu = null;
				this.micMenuAnchor = null;
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

		this.micMenuAnchor = await showMenuAboveAnchor(menu, target);
		this.trackPopoverHover(this.micMenuAnchor);
		return this.micMenuAnchor;
	}

	async openProviderMenu(
		anchor?: HTMLElement | null
	): Promise<HTMLElement | null> {
		const target = anchor ?? this.statusBarItem;
		if (!target || this.activeProviderMenu) {
			return null;
		}
		const current = this.plugin.settings.transcriptionProvider;
		const menu = new Menu();
		this.activeProviderMenu = menu;
		menu.onHide(() => {
			if (this.activeProviderMenu === menu) {
				this.activeProviderMenu = null;
				this.providerMenuAnchor = null;
			}
		});

		for (const module of getEnabledModules(this.plugin.settings)) {
			menu.addItem((item) => {
				item.setTitle(module.label)
					.setChecked(module.id === current)
					.onClick(async () => {
						if (this.isRecordingOrPaused()) {
							new Notice(
								"Provider changes on the next recording"
							);
							return;
						}
						this.plugin.settings.transcriptionProvider = module.id;
						await this.plugin.settingsManager.saveSettings(
							this.plugin.settings
						);
						this.updateStatusBarItem();
						new Notice(module.label);
					});
			});
		}

		this.providerMenuAnchor = await showMenuAboveAnchor(menu, target);
		this.trackPopoverHover(this.providerMenuAnchor);
		return this.providerMenuAnchor;
	}

	updateStatusBarItem() {
		if (!this.statusBarItem) {
			return;
		}
		const module = getModuleById(this.plugin.settings.transcriptionProvider);
		const micFull = this.deviceLabel || "Default";
		const supportsTolerance = module.supportsPauseTolerance;
		const toleranceShort = supportsTolerance
			? getToleranceShortLabel(this.plugin.settings.geminiLivePauseDelay)
			: undefined;
		const core = this.combinedStatusLabel(
			module.statusBarLabel,
			micFull,
			supportsTolerance
				? COMBINED_LABEL_MAX_WITH_TOLERANCE
				: COMBINED_LABEL_MAX,
			toleranceShort
		);
		const isRecording = this.status === RecordingStatus.Recording;
		/* Status is color/pulse only; label stays provider · [tolerance] · mic. */
		const text = core;
		let color: string | null = "gray";
		switch (this.status) {
			case RecordingStatus.Recording:
				color = null; // CSS owns soft red + pulse
				break;
			case RecordingStatus.Paused:
				color = "yellow";
				break;
			case RecordingStatus.Processing:
				color = "green";
				break;
			case RecordingStatus.Idle:
			default:
				color = "gray";
				break;
		}
		const tooltipLines = supportsTolerance
			? `${module.label} — Pause tolerance: ${getToleranceFullLabel(
					this.plugin.settings.geminiLivePauseDelay
			  )} — ${micFull}`
			: `${module.label} — ${micFull}`;
		const hint = supportsTolerance
			? "Click to cycle pause tolerance · Hover for sources"
			: "Hover for sources";
		const tooltip = `${tooltipLines}\n${hint}`;
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
		this.cancelPopoversOpen();
		this.cancelPopoversClose();
		this.hidePopovers();
		if (this.statusBarItem) {
			this.statusBarItem.remove();
		}
	}
}