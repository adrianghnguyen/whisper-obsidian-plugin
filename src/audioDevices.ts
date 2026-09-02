import type Whisper from "main";

export type InputDeviceOption = {
	id: string;
	label: string;
};

export async function applyAudioDeviceSelection(
	plugin: Whisper,
	deviceId: string
): Promise<void> {
	plugin.settings.audioDeviceId = deviceId;
	await plugin.settingsManager.saveSettings(plugin.settings);
	const resolved = deviceId === "default" ? null : deviceId;
	plugin.recorder.setDeviceId(resolved);
	if (plugin.audioHandler.liveStream.isActive) {
		plugin.audioHandler.liveStream.setDeviceId(resolved);
	}
}

export async function listInputDevices(): Promise<InputDeviceOption[]> {
	const list: InputDeviceOption[] = [{ id: "default", label: "Default" }];
	try {
		const allDevices = await navigator.mediaDevices.enumerateDevices();
		for (const device of allDevices) {
			if (device.kind !== "audioinput") continue;
			if (!device.deviceId || device.deviceId === "default") continue;
			list.push({
				id: device.deviceId,
				label:
					device.label ||
					`Unknown device (${device.deviceId.substring(0, 8)})`,
			});
		}
	} catch (err) {
		console.error("Error enumerating audio devices:", err);
	}
	return list;
}

export function resolveDeviceLabel(
	deviceId: string,
	devices: InputDeviceOption[]
): string {
	const match = devices.find((d) => d.id === deviceId);
	if (match) {
		return match.label;
	}
	if (deviceId && deviceId !== "default") {
		return `Unknown device (${deviceId.substring(0, 8)})`;
	}
	return "Default";
}

export function resolveOsDefaultDeviceId(stream: MediaStream): string | null {
	const track = stream.getAudioTracks()[0];
	if (!track) return null;
	const id = track.getSettings().deviceId;
	return id || null;
}

export function formatMicrophoneSettingDesc(
	host: string,
	deviceId: string,
	devices: InputDeviceOption[],
	osDefaultDeviceId?: string | null
): string {
	const syncNote =
		"Each computer stores its own choice in the synced settings file.";
	const currentId = deviceId || "default";

	if (currentId === "default") {
		if (osDefaultDeviceId) {
			const osLabel = resolveDeviceLabel(osDefaultDeviceId, devices);
			if (osLabel !== "Default" && !osLabel.startsWith("Unknown device")) {
				return `On ${host}: System default (${osLabel}). ${syncNote}`;
			}
		}
		return `On ${host}: Default. ${syncNote}`;
	}

	const label = resolveDeviceLabel(currentId, devices);
	return `On ${host}: ${label}. ${syncNote}`;
}
