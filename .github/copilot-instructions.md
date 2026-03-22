# Jekyll Lens Copilot Instructions

## Project Scope

- This repository is a small VS Code extension written in TypeScript.
- Keep changes minimal and targeted.
- Preserve the current architecture: command registration in `src/extension.ts`, search orchestration in `src/search.ts`, and focused helper modules for parsing and file-type concerns.

## Design Preferences

- Prefer simple solutions over clever ones.
- Apply basic separation of concerns, but do not split code into tiny abstractions without a clear benefit.
- Prefer relatively small functions, but do not overdo it.
- Prefer a functional style with local values and pure helpers over mutable shared state.

## Search Behavior

- `title` and `tags` are Markdown-only filters and should only apply to `.md` files.
- `fullText` applies to any searchable text file in the workspace.
- Binary files must not be treated as searchable text. Reuse the file-type helpers instead of duplicating detection logic.
- If search behavior changes, update the webview copy to match.

## Code Organization

- Keep parsing concerns under `src/parsing/`.
- Keep file classification and text-decoding outside the search orchestration path.
- If logic becomes reusable or conceptually distinct, move it into a dedicated module instead of growing `src/search.ts` or `src/extension.ts` further.

## Validation

- After changing TypeScript files, run `npm run compile`.
- If the change affects search semantics or result rendering, verify both the extension logic and the webview copy.