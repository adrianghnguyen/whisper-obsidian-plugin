import type Whisper from "main";
import type { WhistleByteCache } from "./engine";

export function createVaultWhistleCache(plugin: Whisper): WhistleByteCache {
	const base = `${plugin.manifest.dir}/whistle-cache`;
	const adapter = plugin.app.vault.adapter;

	return {
		async read(name: string): Promise<Uint8Array | null> {
			const path = `${base}/${name}`;
			if (!(await adapter.exists(path))) {
				return null;
			}
			return new Uint8Array(await adapter.readBinary(path));
		},
		async write(name: string, data: Uint8Array): Promise<void> {
			if (!(await adapter.exists(base))) {
				await adapter.mkdir(base);
			}
			await adapter.writeBinary(`${base}/${name}`, data);
		},
	};
}
