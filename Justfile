set shell := ["bash", "-lc"]

default:
  @just --list

install:
  @if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; elif [ -f package-lock.json ]; then npm ci; elif [ -f bun.lockb ]; then bun install --frozen-lockfile; else pnpm install; fi

dev:
  @if [ -f pnpm-lock.yaml ]; then pnpm dev; elif [ -f package-lock.json ]; then npm run dev; elif [ -f bun.lockb ]; then bun run dev; else pnpm dev; fi

format:
  @if jq -e '.scripts.format' package.json >/dev/null 2>&1; then if [ -f pnpm-lock.yaml ]; then pnpm format; elif [ -f package-lock.json ]; then npm run format; elif [ -f bun.lockb ]; then bun run format; else pnpm format; fi; else echo 'skip: format'; fi

lint:
  @if jq -e '.scripts.lint' package.json >/dev/null 2>&1; then if [ -f pnpm-lock.yaml ]; then pnpm lint; elif [ -f package-lock.json ]; then npm run lint; elif [ -f bun.lockb ]; then bun run lint; else pnpm lint; fi; else echo 'skip: lint'; fi

typecheck:
  @if jq -e '.scripts.typecheck' package.json >/dev/null 2>&1; then if [ -f pnpm-lock.yaml ]; then pnpm typecheck; elif [ -f package-lock.json ]; then npm run typecheck; elif [ -f bun.lockb ]; then bun run typecheck; else pnpm typecheck; fi; elif [ -f tsconfig.json ]; then if [ -f pnpm-lock.yaml ]; then pnpm exec tsc --noEmit; elif [ -f package-lock.json ]; then npm exec -- tsc --noEmit; elif [ -f bun.lockb ]; then bunx tsc --noEmit; else pnpm exec tsc --noEmit; fi; else echo 'skip: typecheck'; fi

test:
  @if jq -e '.scripts.test' package.json >/dev/null 2>&1; then if [ -f pnpm-lock.yaml ]; then pnpm test; elif [ -f package-lock.json ]; then npm run test; elif [ -f bun.lockb ]; then bun run test; else pnpm test; fi; elif jq -e '.scripts["test:run"]' package.json >/dev/null 2>&1; then if [ -f pnpm-lock.yaml ]; then pnpm test:run; elif [ -f package-lock.json ]; then npm run test:run; elif [ -f bun.lockb ]; then bun run test:run; else pnpm test:run; fi; else echo 'skip: test'; fi

verify: lint typecheck test
