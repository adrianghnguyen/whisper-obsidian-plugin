import { Plugin } from "obsidian";

export enum RecordingStatus {
	Idle = "idle",
	Recording = "recording",
	Processing = "processing",
	Loading = "loading",
}

export class StatusBar {
	plugin: Plugin & { settings?: { transcriptionBackend?: string } };
	statusBarItem: HTMLElement | null = null;
	status: RecordingStatus = RecordingStatus.Idle;

	constructor(plugin: Plugin & { settings?: { transcriptionBackend?: string } }) {
		this.plugin = plugin;
		this.statusBarItem = this.plugin.addStatusBarItem();
		this.updateStatusBarItem();
	}

	updateStatus(status: RecordingStatus) {
		this.status = status;
		this.updateStatusBarItem();
	}

	updateStatusBarItem() {
		if (!this.statusBarItem) return;
		const isLocal =
			(this.plugin as { settings?: { transcriptionBackend?: string } })
				.settings?.transcriptionBackend === "local";
		const prefix = isLocal ? "Whisper(Local) " : "Whisper ";
		switch (this.status) {
			case RecordingStatus.Recording:
				this.statusBarItem.textContent = prefix + "Recording";
				this.statusBarItem.style.color = "red";
				break;
			case RecordingStatus.Processing:
				this.statusBarItem.textContent = prefix + "Processing";
				this.statusBarItem.style.color = "orange";
				break;
			case RecordingStatus.Loading:
				this.statusBarItem.textContent = prefix + "Loading model...";
				this.statusBarItem.style.color = "orange";
				break;
			case RecordingStatus.Idle:
			default:
				this.statusBarItem.textContent = prefix + "Idle";
				this.statusBarItem.style.color = "green";
				break;
		}
	}

	remove() {
		if (this.statusBarItem) {
			this.statusBarItem.remove();
		}
	}
}
