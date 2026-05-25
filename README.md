# jthewl-skills-hub

Public web hub for browsing [JupiterTheWarlock/jthewl-skills](https://github.com/JupiterTheWarlock/jthewl-skills), a Claude Code skills marketplace.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The app reads the public marketplace manifest from:

```text
https://raw.githubusercontent.com/JupiterTheWarlock/jthewl-skills/main/.claude-plugin/marketplace.json
```

It is intentionally read-only: publishing and safety checks happen in the marketplace repository.
