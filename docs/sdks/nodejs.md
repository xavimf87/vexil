---
layout: default
title: Node.js SDK
parent: Client SDKs
nav_order: 3
---

# Node.js SDK

## Installation

```bash
npm install vexil
```

## Quick Start

```typescript
import { Client } from 'vexil';

// From environment variables
const client = new Client({ provider: 'env' });

const darkMode = await client.bool('dark-mode', false);
const rateLimit = await client.int('api-rate-limit', 100);
const banner = await client.string('banner-text', 'Welcome');

console.log({ darkMode, rateLimit, banner });
```

## Providers

### Environment Variables

```typescript
const client = new Client({ provider: 'env' });
```

### Sidecar

```typescript
const client = new Client({
  provider: 'sidecar',
  address: 'http://localhost:8514',
});
```

### ConfigMap

```typescript
const client = new Client({
  provider: 'configmap',
  path: '/etc/vexil',
});
```

## API

All methods are async.

| Method | Signature | Description |
|:-------|:----------|:------------|
| `bool` | `bool(name, defaultVal?) -> Promise<boolean>` | Get boolean flag |
| `string` | `string(name, defaultVal?) -> Promise<string>` | Get string flag |
| `int` | `int(name, defaultVal?) -> Promise<number>` | Get integer flag |
| `json` | `json<T>(name) -> Promise<T \| null>` | Parse JSON flag |
| `getFlag` | `getFlag(name) -> Promise<Flag \| null>` | Get raw flag |
| `allFlags` | `allFlags() -> Promise<Flag[]>` | List all flags |

### Flag Interface

```typescript
interface Flag {
  name: string;
  type: string;    // "boolean", "string", "integer", "json"
  value: string;
  disabled: boolean;
}
```
