# jthewl-skills-hub

Public web hub for browsing [JupiterTheWarlock/jthewl-skills](https://github.com/JupiterTheWarlock/jthewl-skills), a Claude Code skills marketplace.

Live site: [skills.jthewl.cc](https://skills.jthewl.cc)

Related repositories:

- [jthewl-skills-hub](https://github.com/JupiterTheWarlock/jthewl-skills-hub) — this static web UI.
- [jthewl-skills](https://github.com/JupiterTheWarlock/jthewl-skills) — the Claude Code skills marketplace and plugin source.

## Design

See [docs/product-design.md](docs/product-design.md) for the product, data, command, and plugin preview design.

## Development

```bash
npm install
npm run catalog
npm run dev
```

## Build

```bash
npm run build
```

The app reads the generated static catalog from:

```text
public/data/catalog.json
```

`npm run catalog` builds it from the sibling `../jthewl-skills` checkout by merging the marketplace manifest, `.jthewl-hub` metadata, plugin manifests, file trees, preview text, and consensus profile color tokens. Production can deploy the generated catalog without requiring a sibling checkout at runtime.
