import { constants } from 'fs';
import { access } from 'fs/promises';
import path from 'path';

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

export async function load() {
	const projectRoot = process.env.root as string;
	const collectorExePath = path.resolve(projectRoot, 'unity', 'Pixel Collector.exe');

	return {
		currentPath: projectRoot,
		collectorExePath,
		collectorExists: await fileExists(collectorExePath)
	};
}
