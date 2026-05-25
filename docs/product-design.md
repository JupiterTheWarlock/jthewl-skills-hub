# jthewl-skills-hub Product Design

## Goal

`jthewl-skills-hub` is the public browsing and installation surface for `jthewl-skills`.
It should feel like a compact developer tool, not a marketing landing page:

- browse all public plugins from the marketplace
- understand what each plugin is for using human-written hub metadata
- copy the right install or load command without guessing
- inspect each plugin folder with a GitHub-like tree and file preview
- preserve the visual identity from `jthewl-personal` consensus data

## Style Direction

Use the consensus profile as the source of truth:

| Token | Value | Usage |
|---|---:|---|
| `--accent` | `#DA7756` | primary action, selected state, active tree line |
| `--accent-bright` | `#E8985C` | hover, copy success, subtle highlights |
| `--accent-dim` | `#B85D3A` | pressed state, warnings |
| `--accent-glow` | `rgba(218, 119, 86, 0.4)` | focused controls, active panel glow |
| `--bg-deep` | `#0A0908` | page background |
| `--bg-card` | `rgba(14, 12, 10, 0.85)` | panels and sidebars |
| `--text-primary` | `#E8E0D8` | body text |
| `--text-secondary` | `#8A7E74` | metadata and muted labels |
| `--text-bright` | `#FAF0E8` | headings and active labels |
| `--border` | `#2E2520` | panel borders |
| `--border-light` | `#4A3D33` | hover/focus borders |

Visual rules:

- dark terminal/cyberpunk mood with Claude Code orange as the only strong accent
- dense application layout: left plugin list, center detail, right or lower file preview
- no hero card, no decorative blobs, no soft pastel palette
- 8px radius max for panels and controls
- monospace for commands, file paths, tree nodes, and code preview
- lucide icons for copy, external link, file, folder, search, terminal, download, refresh

## Information Architecture

Top-level app shell:

1. Header bar
   - `JupiterTheWarlock / jthewl-skills`
   - marketplace status
   - GitHub repo link
   - last sync timestamp
2. Command strip
   - marketplace add command
   - selected plugin install command
   - no-marketplace session load command when available
3. Plugin browser
   - searchable plugin list
   - filters: category, author, provenance, updated recently, tags
4. Plugin detail
   - hub description
   - official marketplace description
   - metadata table
   - command cards
   - component inventory
5. Plugin file explorer
   - tree rooted at `plugins/<plugin-name>/`
   - file content preview
   - raw GitHub link
   - copy path / copy content

Mobile layout stacks in this order: header, command strip, plugin list, detail, file explorer.

## Plugin Preview

Each plugin is treated as a folder root, matching the user's mental model and GitHub's repository browsing behavior.

Data needed per plugin:

- normalized tree: directories first, files second, sorted by path
- file size and extension
- text/binary classification
- default preview file
- raw URL for file contents
- GitHub URL for the selected file

Default preview priority:

1. `README.md`
2. `skills/*/SKILL.md`
3. `.claude-plugin/plugin.json`
4. first text file under the plugin root

Explorer behavior:

- clicking a folder toggles it
- clicking a file fetches raw text and opens preview
- selected file path is shown as a breadcrumb
- Markdown files render as readable text first; syntax highlighting can be added later
- large files over 250 KB show metadata and a "view raw" link instead of loading into the page
- binary files show metadata only

Implementation options:

- v1 preferred: generate `public/data/catalog.json` at build time from the sibling `jthewl-skills` checkout
- fallback: fetch GitHub tree and raw file contents at runtime from `JupiterTheWarlock/jthewl-skills`

Build-time generation is better for deployment because GitHub API limits and CORS behavior are outside the app's control.

## Commands

Show commands as copyable cards with a short label. Provide both Claude Code slash-command and CLI forms where they differ.

Marketplace add:

```text
/plugin marketplace add JupiterTheWarlock/jthewl-skills
```

```bash
claude plugin marketplace add JupiterTheWarlock/jthewl-skills
```

Install after marketplace is added:

```text
/plugin install <plugin-name>@jthewl-skills
```

```bash
claude plugin install <plugin-name>@jthewl-skills
```

No-marketplace use:

Claude Code's persistent install flow is marketplace-based. For users who have not added the marketplace, expose this as "load for this session" rather than "install":

```bash
claude --plugin-url https://jthewl.cc/plugins/<plugin-name>.zip
```

Local development equivalent:

```bash
claude --plugin-dir ./plugins/<plugin-name>
```

To support `--plugin-url`, the skills repo or hub deployment must publish one zip per plugin where the zip root is the plugin root containing `.claude-plugin/plugin.json`, `skills/`, and other plugin files.

## Custom Hub Metadata

Do not overload `.claude-plugin/marketplace.json` with hub-only data. It should stay compatible with Claude Code validation.

Add one hub metadata file per plugin under a hub-owned metadata directory:

```text
.jthewl-hub/
  plugin.schema.json
  plugins/
    <plugin-name>.json
```

Schema:

```json
{
  "$schema": "../plugin.schema.json",
  "name": "git-sync",
  "hubDesc": "面向 meta-repo 的多仓库同步治理工具，适合主仓库、子模块和根目录独立仓库混合存在的工作区。",
  "shortLabel": "Multi-repo sync",
  "status": "stable",
  "updatedAt": "2026-05-22",
  "maintainer": {
    "name": "JupiterTheWarlock",
    "url": "https://github.com/JupiterTheWarlock"
  },
  "originalAuthor": {
    "name": "JupiterTheWarlock",
    "url": "https://github.com/JupiterTheWarlock"
  },
  "provenance": {
    "type": "original",
    "sourceName": "",
    "sourceUrl": "",
    "license": "MIT",
    "notes": ""
  },
  "links": [
    {
      "label": "Repository",
      "url": "https://github.com/JupiterTheWarlock/jthewl-skills"
    }
  ],
  "useCases": [
    "同步 meta-repo 根仓库、submodules、独立子仓库",
    "生成每个 repo 独立 commit message"
  ],
  "warnings": [
    "运行前应确认当前工作区没有不想提交的本地改动"
  ],
  "screenshots": []
}
```

Field policy:

- `marketplace.json.description`: short official install-facing summary
- `.jthewl-hub/plugins/<plugin-name>.json`: richer, self-written explanation for humans
- `updatedAt`: explicit release/update date; fallback can be latest git commit date touching the plugin folder
- `maintainer`: current package maintainer in this marketplace
- `originalAuthor`: original creator; can differ from maintainer for adapted or mirrored plugins
- `provenance`: required when carrying or adapting someone else's plugin
- `links`: docs, original source, issue tracker, article, demo, or related project
- `warnings`: practical caveats visible before copy/install

Keep this data outside `plugins/<plugin-name>/` because it belongs to the hub/catalog layer, not the Claude Code runtime package. This avoids changing third-party plugin roots, keeps plugin cache contents clean, and lets the hub describe external or mirrored plugins even when their source directories should stay untouched.

Add a root schema and generated index:

```text
.jthewl-hub/
  plugin.schema.json
  catalog.schema.json
  plugins/
    git-sync.json
    project-skill-governance.json
    xhs-note-scraper.json
public/data/catalog.json
```

`catalog.json` is generated and should contain merged marketplace data, hub metadata, component inventory, file tree, and zip URLs.

## Data Pipeline

Recommended scripts in `jthewl-skills-hub`:

```text
scripts/build-catalog.ts
scripts/package-plugins.ts
```

`build-catalog.ts`:

1. read `../jthewl-skills/.claude-plugin/marketplace.json`
2. for each plugin source, read `.claude-plugin/plugin.json`
3. read optional `.jthewl-hub/plugins/<plugin-name>.json`
4. scan plugin files into a safe tree
5. compute fallback `updatedAt` from `git log -1 --format=%cs -- <plugin-dir>`
6. write `public/data/catalog.json`

`package-plugins.ts`:

1. zip each `plugins/<plugin-name>/` folder
2. write artifacts to `public/plugins/<plugin-name>.zip`
3. write zip URL into `catalog.json`

Files to exclude from tree and zip:

- `.git/`
- `node_modules/`
- dependency caches
- local `.env*`
- build outputs unless required by the plugin
- private notes

## UI States

Required states:

- loading catalog
- catalog load error with raw GitHub fallback action
- empty search
- selected plugin with missing `.jthewl-hub` metadata
- selected plugin with missing preview file
- file content loading
- file content error
- binary/large file preview unavailable
- copy success

## Implementation Phases

Phase 1:

- replace current light theme with consensus dark/orange tokens
- add command strip with marketplace add and install commands
- add `.jthewl-hub` schema and plugin metadata to `jthewl-skills`
- generate static `catalog.json` from marketplace and hub metadata

Phase 2:

- add plugin file tree and text preview
- add raw/GitHub links and copy actions
- add missing metadata warnings in the UI

Phase 3:

- publish per-plugin zip artifacts
- expose `claude --plugin-url <zip>` session-load command
- add component inventory and estimated context footprint if available

Phase 4:

- add richer Markdown rendering and syntax highlighting
- add provenance badges for original/adapted/mirrored plugins
- add update history or changelog panel

## Decisions

- Production deployment should let `jthewl-skills-hub` build independently from generated/static catalog artifacts. Local development may read sibling `../jthewl-skills`, but production should not require a sibling checkout.
- Third-party, adapted, mirrored, and curated plugins should be visually identified with provenance badges.
- Hub-only plugin metadata lives under `jthewl-skills/.jthewl-hub/plugins/*.json`, not inside plugin runtime roots.
