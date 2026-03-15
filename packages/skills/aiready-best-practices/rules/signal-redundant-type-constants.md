---
title: Avoid Redundant Type Constants
impact: MEDIUM
impactDescription: Boilerplate constants for primitive types add noise and reduce semantic transparency
tags: signal, clean-code, typescript, json-schema
---

## Avoid Redundant Type Constants

**Impact: MEDIUM (Boilerplate noise & indirection)**

Defining local constants like `const TYPE_STRING = 'string'` or `const TYPE_OBJECT = 'object'` for JSON Schema types is redundant in modern TypeScript codebases. These constants add an indirection layer that requires a lookup without providing functional benefit, as these are already primitive types.

### Core Principles

- **Direct Literals:** Use 'string', 'object', 'array', etc. directly in schemas for transparency.
- **TypeScript Union Types:** Use TypeScript's native type system (e.g., `type: 'string' | 'object' | 'array'`) for IDE autocompletion and safety.
- **Centralized Types:** If constants are required for system-wide refactors, they should be in a central `types.ts` rather than redefined per file.

### Guidelines

- **Incorrect:**

```typescript
const TYPE_STRING = 'string';
const TYPE_OBJECT = 'object';

const schema = {
  type: TYPE_OBJECT,
  properties: {
    name: { type: TYPE_STRING },
  },
};
```

- **Correct:**

```typescript
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
};
```

**Advice for developer:**
Favor "AI-native" code where transparency is key. Models and humans working with JSON Schema expect literals. indirection layers like local constants for primitives should be removed.

Reference: [AI Signal Clarity Docs](https://getaiready.dev/docs)
