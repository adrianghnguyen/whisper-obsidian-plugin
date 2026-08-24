import { Notice, setIcon } from "obsidian";
import Whisper from "main";
import { listInputDevices } from "./audioDevices";

export enum RecordingStatus {
	Idle = "idle",
	Recording = "recording",
	Paused = "paused",
	Processing = "processing",
}

export class StatusBar {
	plugin: Whisper;
	statusBarItem: HTMLElement | null = null;
	status: RecordingStatus = RecordingStatus.Idle;
	private listeners: Array<(status: RecordingStatus) => void> = [];
	private deviceLabel = "Default";
	private permissionRequested = false;

	constructor(plugin: Whisper) {
		this.plugin = plugin;
		this.statusBarItem = this.plugin.addStatusBarItem();
		this.statusBarItem.addClass("whisper-status-bar");
		this.statusBarItem.addEventListener("click", () => {
			void this.cycleDevice();
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
				this.plugin.settings.audioDeviceId = "default";
				await this.plugin.settingsManager.saveSettings(
					this.plugin.settings
				);
				this.plugin.recorder.setDeviceId(null);
			}
		}
		this.updateStatusBarItem();
	}

	async cycleDevice(): Promise<void> {
		if (
			this.status === RecordingStatus.Recording ||
			this.status === RecordingStatus.Paused
		) {
			new Notice("Microphone changes on the next recording");
			return;
		}
		if (!this.permissionRequested) {
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
		const devices = await listInputDevices();
		let currentId = this.plugin.settings.audioDeviceId || "default";
		if (!devices.some((d) => d.id === currentId)) {
			currentId = "default";
		}
		const idx = devices.findIndex((d) => d.id === currentId);
		const next = devices[(idx < 0 ? 0 : idx + 1) % devices.length];
		this.plugin.settings.audioDeviceId = next.id;
		await this.plugin.settingsManager.saveSettings(this.plugin.settings);
		this.plugin.recorder.setDeviceId(
			next.id === "default" ? null : next.id
		);
		this.deviceLabel = next.label;
		this.updateStatusBarItem();
		new Notice(next.label);
	}

	updateStatusBarItem() {
		if (!this.statusBarItem) {
			return;
		}
		const full = this.deviceLabel || "Default";
		const short = this.shortLabel(full);
		let text = short;
		let color = "green";
		switch (this.status) {
			case RecordingStatus.Recording:
				text = `Recording · ${short}`;
				color = "red";
				break;
			case RecordingStatus.Paused:
				text = `Paused · ${short}`;
				color = "yellow";
				break;
			case RecordingStatus.Processing:
				text = `Processing · ${short}`;
				color = "gray";
				break;
			case RecordingStatus.Idle:
			default:
				text = short;
				color = "green";
				break;
		}
		this.statusBarItem.empty();
		this.statusBarItem.style.color = color;
		setIcon(this.statusBarItem, "mic");
		this.statusBarItem.appendText(text);
		this.statusBarItem.setAttribute("title", full);
		this.statusBarItem.setAttribute("aria-label", full);
	}

	remove() {
		if (this.statusBarItem) {
			this.statusBarItem.remove();
		}
	}
}
