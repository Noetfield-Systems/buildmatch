# AGENTS.md

Guidance for AI agents working in this repository.

## Project status

**buildmatch** is in an initial stub state: the tracked tree is only `README.md` (title: `# buildmatch`). There is no application source, dependency manifest, Docker/Compose config, CI workflow, or test suite yet.

When application code lands, re-read the repo root for `package.json`, `docker-compose.yml`, `Makefile`, `.devcontainer/`, and `README.md` setup sections, then follow those commands instead of assuming a stack.

## Cursor Cloud specific instructions

### What runs today

No long-lived services are defined in this repository. There is nothing to lint, test, build, or start until the first real application commit.

### VM toolchain (already on the image)

| Tool | Notes |
|------|--------|
| Git | Clone/pull on `main` |
| Node.js | v22 via nvm (`node`, `npm`, `pnpm`, `yarn`) |
| Python | 3.12 (`python3`) |
| Docker | Not required for the current stub; install only if the repo later adds `docker-compose` |

### After the first application commit

Typical checks (adjust to whatever the repo adds):

- **Node**: `npm ci` or `pnpm install --frozen-lockfile`, then scripts from `package.json` (e.g. `npm run lint`, `npm test`, `npm run dev`).
- **Python**: `pip install -r requirements.txt` or `uv sync`, then project test/lint commands from `README.md` or `pyproject.toml`.
- **Docker**: `docker compose up` only if documented in the repo; do not add compose services to the VM **update script** (startup dependency refresh only).

### Gotchas

- The VM **update script** uses guarded installs so an empty repo does not fail; once `package-lock.json` or `pnpm-lock.yaml` exists, dependency refresh runs automatically on agent startup.
- Do not assume Supabase, Next.js, or other stacks until config files appear in the tree.
