# Contributing

This is a small personal project. Contributions are welcome, but there's no formal
process beyond what's below.

## Setup

```bash
git clone https://github.com/jimmyjames177414/claude-roundtable.git
cd claude-roundtable
npm install
npm run build
npm test
```

Node 20 or 22 to run the full test suite (`npm test`) - vitest's own tooling needs
20+ to even start. The built CLI itself still supports Node 18 (see the CI workflow
for how that's verified separately). `.nvmrc` points at 20.

## Before opening a PR

- `npm test` passes.
- `npm run build` succeeds.
- New behavior gets a test - see `test/*.test.ts` for the existing style: dependency
  injection via the `deps` object in `src/cli.ts`, no real network calls in tests.

## Reporting bugs / security issues

Regular bugs: open an issue. Anything security-related: see [SECURITY.md](./SECURITY.md)
instead.
