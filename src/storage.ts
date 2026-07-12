import type { DriftBottle, NewDriftBottle } from './types.js';

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

interface BottleFile {
  version: 1;
  bottles: DriftBottle[];
}

export class BottleStore {
  private bottles: DriftBottle[] = [];
  private saveQueue = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      const content = await readFile(this.filePath, 'utf8');
      const data = JSON.parse(content) as BottleFile;

      if (data.version !== 1 || !Array.isArray(data.bottles)) {
        throw new Error('漂流瓶数据文件格式不正确');
      }

      this.bottles = data.bottles;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async add(input: NewDriftBottle): Promise<DriftBottle> {
    const bottle: DriftBottle = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    this.bottles.push(bottle);
    await this.save();
    return bottle;
  }

  async take(randomValue = Math.random()): Promise<DriftBottle | undefined> {
    if (this.bottles.length === 0) {
      return undefined;
    }

    const index = Math.floor(randomValue * this.bottles.length);
    const [bottle] = this.bottles.splice(index, 1);
    await this.save();
    return bottle;
  }

  count(): number {
    return this.bottles.length;
  }

  private save(): Promise<void> {
    const content = `${JSON.stringify({ version: 1, bottles: this.bottles }, null, 2)}\n`;
    const pendingSave = this.saveQueue
      .catch(() => undefined)
      .then(async () => {
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(`${this.filePath}.tmp`, content, 'utf8');
        await rename(`${this.filePath}.tmp`, this.filePath);
      });

    this.saveQueue = pendingSave;
    return pendingSave;
  }
}
