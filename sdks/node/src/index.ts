/**
 * Vexil - Node.js SDK for Kubernetes-native Feature Flags
 *
 * @example
 * ```typescript
 * import { Client } from 'vexil';
 *
 * // Env var mode (reads FLAG_* environment variables)
 * const client = new Client({ provider: 'env' });
 *
 * // Sidecar mode (connects to localhost:8514)
 * const client = new Client({ provider: 'sidecar' });
 *
 * // ConfigMap mode (reads mounted files)
 * const client = new Client({ provider: 'configmap', path: '/etc/vexil' });
 *
 * const darkMode = await client.bool('dark-mode', false);
 * const rateLimit = await client.int('api-rate-limit', 100);
 * ```
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface Flag {
  name: string;
  type: string;
  value: string;
  disabled: boolean;
}

export interface ClientOptions {
  provider: 'env' | 'sidecar' | 'configmap';
  address?: string;
  path?: string;
}

export class Client {
  private provider: string;
  private address: string;
  private configPath: string;

  constructor(options: ClientOptions) {
    this.provider = options.provider;
    this.address = options.address || 'http://localhost:8514';
    this.configPath = options.path || '/etc/vexil';

    if (!this.address.startsWith('http')) {
      this.address = `http://${this.address}`;
    }
  }

  async bool(name: string, defaultVal: boolean = false): Promise<boolean> {
    const flag = await this.getFlag(name);
    if (!flag || flag.disabled) return defaultVal;
    return ['true', '1', 'yes'].includes(flag.value.toLowerCase());
  }

  async string(name: string, defaultVal: string = ''): Promise<string> {
    const flag = await this.getFlag(name);
    if (!flag || flag.disabled) return defaultVal;
    return flag.value;
  }

  async int(name: string, defaultVal: number = 0): Promise<number> {
    const flag = await this.getFlag(name);
    if (!flag || flag.disabled) return defaultVal;
    const parsed = parseInt(flag.value, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  }

  async json<T = unknown>(name: string): Promise<T | null> {
    const flag = await this.getFlag(name);
    if (!flag || flag.disabled) return null;
    return JSON.parse(flag.value) as T;
  }

  async getFlag(name: string): Promise<Flag | null> {
    switch (this.provider) {
      case 'env':
        return this.getEnv(name);
      case 'sidecar':
        return this.getSidecar(name);
      case 'configmap':
        return this.getConfigMap(name);
      default:
        return null;
    }
  }

  async allFlags(): Promise<Flag[]> {
    switch (this.provider) {
      case 'env':
        return this.allEnv();
      case 'sidecar':
        return this.allSidecar();
      case 'configmap':
        return this.allConfigMap();
      default:
        return [];
    }
  }

  // --- Env Provider ---

  private getEnv(name: string): Flag | null {
    const envName = `FLAG_${name.toUpperCase().replace(/-/g, '_')}`;
    const value = process.env[envName];
    if (value === undefined) return null;
    return { name, type: 'string', value, disabled: false };
  }

  private allEnv(): Flag[] {
    return Object.entries(process.env)
      .filter(([key]) => key.startsWith('FLAG_'))
      .map(([key, value]) => ({
        name: key.slice(5).toLowerCase().replace(/_/g, '-'),
        type: 'string',
        value: value || '',
        disabled: false,
      }));
  }

  // --- Sidecar Provider ---

  private async getSidecar(name: string): Promise<Flag | null> {
    try {
      const resp = await fetch(`${this.address}/flags/${name}`);
      if (!resp.ok) return null;
      return (await resp.json()) as Flag;
    } catch {
      return null;
    }
  }

  private async allSidecar(): Promise<Flag[]> {
    try {
      const resp = await fetch(`${this.address}/flags`);
      if (!resp.ok) return [];
      return (await resp.json()) as Flag[];
    } catch {
      return [];
    }
  }

  // --- ConfigMap Provider ---

  private getConfigMap(name: string): Flag | null {
    try {
      const stat = statSync(this.configPath);
      if (stat.isDirectory()) {
        const filePath = join(this.configPath, name);
        if (!existsSync(filePath)) return null;
        const value = readFileSync(filePath, 'utf-8').trim();
        return { name, type: 'string', value, disabled: false };
      }
      // JSON file mode
      const data = JSON.parse(readFileSync(this.configPath, 'utf-8'));
      if (!(name in data)) return null;
      return { name, type: 'string', value: String(data[name]), disabled: false };
    } catch {
      return null;
    }
  }

  private allConfigMap(): Flag[] {
    try {
      const stat = statSync(this.configPath);
      if (stat.isDirectory()) {
        return readdirSync(this.configPath)
          .filter((f) => !f.startsWith('.'))
          .map((f) => ({
            name: f,
            type: 'string',
            value: readFileSync(join(this.configPath, f), 'utf-8').trim(),
            disabled: false,
          }));
      }
      const data = JSON.parse(readFileSync(this.configPath, 'utf-8'));
      return Object.entries(data).map(([k, v]) => ({
        name: k,
        type: 'string',
        value: String(v),
        disabled: false,
      }));
    } catch {
      return [];
    }
  }
}
