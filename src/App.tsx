import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  File,
  Folder,
  Package,
  Search,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import './App.css'

const CATALOG_URL = '/data/catalog.json'
const HUB_REPO_URL = 'https://github.com/JupiterTheWarlock/jthewl-skills-hub'
const MARKETPLACE_REPO_URL = 'https://github.com/JupiterTheWarlock/jthewl-skills'
const EMPTY_PLUGINS: CatalogPlugin[] = []

type Person = {
  name: string
  url?: string
}

type FileTreeEntry =
  | { path: string; type: 'directory' }
  | {
      path: string
      type: 'file'
      size: number
      extension: string
      isText: boolean
      isLarge: boolean
      rawUrl: string
      githubUrl: string
    }

type CatalogPlugin = {
  name: string
  source: string
  description: string
  version: string
  category?: string
  tags?: string[]
  license?: string
  author?: Person
  hub?: {
    hubDesc?: string
    shortLabel?: string
    status?: string
    updatedAt?: string
    maintainer?: Person
    originalAuthor?: Person
    provenance?: {
      type?: string
      license?: string
      sourceName?: string
      sourceUrl?: string
      notes?: string
    }
    links?: Array<{ label: string; url: string }>
    useCases?: string[]
    warnings?: string[]
  } | null
  runtimeManifest?: unknown
  commands: {
    slashInstall: string
    cliInstall: string
    sessionLoad: string
    localDev: string
  }
  updatedAt?: string | null
  zipUrl: string
  githubUrl: string
  fileTree: FileTreeEntry[]
  defaultPreview: string | null
  previewContents: Record<string, string>
  inventory: {
    manifests: number
    skills: number
    scripts: number
    files: number
  }
}

type Catalog = {
  generatedAt: string
  source: {
    repository: string
  }
  brand?: {
    identity?: {
      name?: string
      english_name?: string
      bio?: string
    }
    colorScheme?: Record<string, string>
  }
  marketplace: {
    name: string
    description: string
    version: string
  }
  commands: {
    marketplaceAdd: string
    cliMarketplaceAdd: string
  }
  plugins: CatalogPlugin[]
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: Catalog }
  | { status: 'error'; message: string }

function formatDate(value?: string | null) {
  if (!value) return 'unknown'
  return value.slice(0, 10)
}

function formatSize(bytes?: number) {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(bytes > 1024 * 100 ? 0 : 1)} KB`
}

function parentPath(filePath: string) {
  const parts = filePath.split('/')
  parts.pop()
  return parts.join('/')
}

function depthOf(filePath: string) {
  return filePath.split('/').length - 1
}

function isVisible(entry: FileTreeEntry, openFolders: Set<string>) {
  const parents = parentPath(entry.path).split('/').filter(Boolean)
  let cursor = ''
  for (const part of parents) {
    cursor = cursor ? `${cursor}/${part}` : part
    if (!openFolders.has(cursor)) return false
  }
  return true
}

function commandLabel(command: string) {
  if (command.startsWith('/')) return 'Claude Code'
  if (command.includes('--plugin-url')) return 'Session load'
  if (command.includes('--plugin-dir')) return 'Local dev'
  return 'CLI'
}

function GitHubMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      focusable="false"
    >
      <path d="M8 0C3.58 0 0 3.67 0 8.2c0 3.63 2.29 6.7 5.47 7.78.4.08.55-.18.55-.4 0-.2-.01-.86-.01-1.56-2.01.38-2.53-.5-2.69-.95-.09-.23-.48-.95-.82-1.14-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.83.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.09-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.42 7.42 0 0 1 8 3.97c.68 0 1.36.09 2 .27 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.25.54.75.54 1.52 0 1.1-.01 1.98-.01 2.25 0 .22.15.48.55.4A8.13 8.13 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z" />
    </svg>
  )
}

function CommandCard({
  command,
  copiedKey,
  copyError,
  onCopy,
}: {
  command: string
  copiedKey: string | null
  copyError: string | null
  onCopy: (value: string, key: string) => void
}) {
  const key = command

  return (
    <button className="commandCard" type="button" onClick={() => onCopy(command, key)}>
      <span>
        <Terminal size={15} />
        {commandLabel(command)}
      </span>
      <code>{command}</code>
      {copiedKey === key ? <Check size={16} /> : copyError === key ? <AlertCircle size={16} /> : <Copy size={16} />}
    </button>
  )
}

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [provenance, setProvenance] = useState('all')
  const [tag, setTag] = useState('all')
  const [recentOnly, setRecentOnly] = useState(false)
  const [activeName, setActiveName] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>({})
  const [openFolderPaths, setOpenFolderPaths] = useState<Record<string, string[]>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCatalog() {
      try {
        const response = await fetch(CATALOG_URL)
        if (!response.ok) throw new Error(`catalog.json returned ${response.status}`)
        const data = (await response.json()) as Catalog
        if (!cancelled) {
          setState({ status: 'ready', data })
          setActiveName(data.plugins[0]?.name ?? null)
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to load catalog',
          })
        }
      }
    }

    loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  const catalog = state.status === 'ready' ? state.data : null
  const plugins = useMemo(() => catalog?.plugins ?? EMPTY_PLUGINS, [catalog])
  const normalizedQuery = query.trim().toLowerCase()
  const recentThreshold = catalog
    ? new Date(catalog.generatedAt).getTime() - 1000 * 60 * 60 * 24 * 45
    : 0

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(plugins.map((plugin) => plugin.category ?? 'Uncategorized'))).sort()],
    [plugins],
  )
  const tags = useMemo(
    () => ['all', ...Array.from(new Set(plugins.flatMap((plugin) => plugin.tags ?? []))).sort()],
    [plugins],
  )
  const provenances = useMemo(
    () => [
      'all',
      ...Array.from(new Set(plugins.map((plugin) => plugin.hub?.provenance?.type ?? 'unknown'))).sort(),
    ],
    [plugins],
  )

  const filteredPlugins = useMemo(() => {
    return plugins.filter((plugin) => {
      const haystack = [
        plugin.name,
        plugin.description,
        plugin.hub?.hubDesc,
        plugin.category,
        plugin.license,
        plugin.hub?.shortLabel,
        ...(plugin.tags ?? []),
        ...(plugin.hub?.useCases ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const updatedAt = plugin.updatedAt ? new Date(plugin.updatedAt).getTime() : 0

      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (category === 'all' || (plugin.category ?? 'Uncategorized') === category) &&
        (provenance === 'all' || (plugin.hub?.provenance?.type ?? 'unknown') === provenance) &&
        (tag === 'all' || (plugin.tags ?? []).includes(tag)) &&
        (!recentOnly || updatedAt >= recentThreshold)
      )
    })
  }, [category, normalizedQuery, plugins, provenance, recentOnly, recentThreshold, tag])

  const activePlugin =
    filteredPlugins.find((plugin) => plugin.name === activeName) ?? filteredPlugins[0] ?? null

  const defaultOpenFolders = useMemo(() => {
    if (!activePlugin) return new Set<string>()
    return new Set(
      activePlugin.fileTree
      .filter((entry) => entry.type === 'directory')
      .map((entry) => entry.path)
      .slice(0, 6),
    )
  }, [activePlugin])

  const selectedFile = activePlugin ? (selectedFiles[activePlugin.name] ?? activePlugin.defaultPreview) : null
  const openFolders = activePlugin
    ? new Set(openFolderPaths[activePlugin.name] ?? Array.from(defaultOpenFolders))
    : new Set<string>()

  const selectedEntry = activePlugin?.fileTree.find(
    (entry): entry is Extract<FileTreeEntry, { type: 'file' }> =>
      entry.type === 'file' && entry.path === selectedFile,
  )
  const selectedContent = selectedFile && activePlugin ? activePlugin.previewContents[selectedFile] : null
  const visibleEntries = activePlugin
    ? activePlugin.fileTree.filter((entry) => isVisible(entry, openFolders))
    : []

  const brandStyle = useMemo(() => {
    const scheme = catalog?.brand?.colorScheme
    if (!scheme) return undefined
    return {
      '--accent': scheme.accent,
      '--accent-bright': scheme.accent_bright,
      '--accent-dim': scheme.accent_dim,
      '--accent-glow': scheme.accent_glow,
      '--bg-deep': scheme.bg_deep,
      '--bg-card': scheme.bg_card,
      '--text-primary': scheme.text_primary,
      '--text-secondary': scheme.text_secondary,
      '--text-bright': scheme.text_bright,
      '--border': scheme.border,
      '--border-light': scheme.border_light,
    } as CSSProperties
  }, [catalog])

  function fallbackCopy(value: string) {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  }

  async function copyValue(value: string, key: string) {
    setCopiedKey(key)
    setCopyError(null)

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else if (!fallbackCopy(value)) {
        throw new Error('Clipboard API unavailable')
      }
    } catch {
      if (!fallbackCopy(value)) {
        setCopiedKey(null)
        setCopyError(key)
      }
    }

    window.setTimeout(() => {
      setCopiedKey(null)
      setCopyError(null)
    }, 1400)
  }

  function toggleFolder(pathValue: string) {
    if (!activePlugin) return
    setOpenFolderPaths((current) => {
      const next = new Set(current[activePlugin.name] ?? Array.from(defaultOpenFolders))
      if (next.has(pathValue)) next.delete(pathValue)
      else next.add(pathValue)
      return { ...current, [activePlugin.name]: Array.from(next) }
    })
  }

  function selectFile(pathValue: string) {
    if (!activePlugin) return
    setSelectedFiles((current) => ({ ...current, [activePlugin.name]: pathValue }))
  }

  return (
    <main className="shell" style={brandStyle}>
      <header className="topbar">
        <div>
          <p className="eyebrow">{catalog?.brand?.identity?.english_name ?? 'JupiterTheWarlock'}</p>
          <h1>JupiterTheWarlock / jthewl-skills</h1>
        </div>
        <div className="topbarActions">
          <span className={state.status === 'ready' ? 'statusDot ready' : 'statusDot'}>
            {state.status === 'ready' ? 'catalog ready' : state.status}
          </span>
          <a className="textIconButton" href={HUB_REPO_URL} rel="noreferrer" aria-label="Open hub GitHub repository">
            <GitHubMark />
            hub repo
          </a>
          <a
            className="textIconButton"
            href={MARKETPLACE_REPO_URL}
            rel="noreferrer"
            aria-label="Open skills marketplace GitHub repository"
          >
            <GitHubMark />
            skills marketplace
          </a>
        </div>
      </header>

      <section className="globalCommands" aria-label="Marketplace setup commands">
        <div className="commandHeading">
          <strong>Global setup</strong>
          <span>Add this marketplace once, then install plugins from their detail panel.</span>
        </div>
        <div className="commandStrip">
          <CommandCard
            command={catalog?.commands.marketplaceAdd ?? '/plugin marketplace add JupiterTheWarlock/jthewl-skills'}
            copiedKey={copiedKey}
            copyError={copyError}
            onCopy={copyValue}
          />
          <CommandCard
            command={catalog?.commands.cliMarketplaceAdd ?? 'claude plugin marketplace add JupiterTheWarlock/jthewl-skills'}
            copiedKey={copiedKey}
            copyError={copyError}
            onCopy={copyValue}
          />
        </div>
      </section>

      <section className="summary" aria-label="Marketplace status">
        <div>
          <span className="metric">{plugins.length}</span>
          <span className="metricLabel">plugins</span>
        </div>
        <div>
          <span className="metric">{catalog?.marketplace.version ?? '-'}</span>
          <span className="metricLabel">marketplace</span>
        </div>
        <div>
          <span className="metric">{catalog ? formatDate(catalog.generatedAt) : '-'}</span>
          <span className="metricLabel">last sync</span>
        </div>
      </section>

      <section className="workspace">
        <aside className="sidebar" aria-label="Plugin browser">
          <label className="searchBox">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search plugins, tags, use cases"
              type="search"
            />
          </label>

          <div className="filters">
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category filter">
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select value={provenance} onChange={(event) => setProvenance(event.target.value)} aria-label="Provenance filter">
              {provenances.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select value={tag} onChange={(event) => setTag(event.target.value)} aria-label="Tag filter">
              {tags.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <label className="checkFilter">
              <input
                checked={recentOnly}
                onChange={(event) => setRecentOnly(event.target.checked)}
                type="checkbox"
              />
              recent
            </label>
          </div>

          {state.status === 'loading' ? <div className="notice">Loading catalog...</div> : null}
          {state.status === 'error' ? (
            <div className="notice error">
              <AlertCircle size={18} />
              <span>{state.message}</span>
              <a href={`${MARKETPLACE_REPO_URL}/blob/main/.claude-plugin/marketplace.json`} target="_blank" rel="noreferrer">
                raw fallback
              </a>
            </div>
          ) : null}

          <div className="pluginList">
            {filteredPlugins.map((plugin) => (
              <button
                className={plugin.name === activePlugin?.name ? 'pluginRow active' : 'pluginRow'}
                key={plugin.name}
                type="button"
                onClick={() => setActiveName(plugin.name)}
              >
                <Package size={17} />
                <span>
                  <strong>{plugin.name}</strong>
                  <small>
                    {plugin.hub?.shortLabel ?? plugin.category ?? 'Plugin'} · {formatDate(plugin.updatedAt)}
                  </small>
                </span>
              </button>
            ))}
            {state.status === 'ready' && filteredPlugins.length === 0 ? (
              <div className="emptyState">No matching plugins.</div>
            ) : null}
          </div>
        </aside>

        <section className="detail" aria-label="Plugin detail">
          {activePlugin ? (
            <>
              <div className="detailHeader">
                <div>
                  <p className="eyebrow">{activePlugin.category ?? 'Plugin'}</p>
                  <h2>{activePlugin.name}</h2>
                </div>
                <div className="actions">
                  <button
                    className="textIconButton"
                    type="button"
                    onClick={() => copyValue(activePlugin.commands.slashInstall, activePlugin.commands.slashInstall)}
                    aria-label="Copy install command"
                    title="Copy install command"
                  >
                    {copiedKey === activePlugin.commands.slashInstall ? <Check size={18} /> : <Copy size={18} />}
                    copy install
                  </button>
                  <a
                    className="textIconButton"
                    href={activePlugin.githubUrl}
                    rel="noreferrer"
                    aria-label="Open plugin source"
                    title="Open plugin source"
                  >
                    <ExternalLink size={18} />
                    source
                  </a>
                </div>
              </div>

              {!activePlugin.hub ? (
                <div className="inlineWarning">
                  <AlertCircle size={16} />
                  Missing `.jthewl-hub` metadata. Showing marketplace fields only.
                </div>
              ) : null}

              <p className="description">{activePlugin.hub?.hubDesc ?? activePlugin.description}</p>
              <p className="marketplaceDesc">{activePlugin.description}</p>

              <div className="pluginCommands">
                <div className="commandHeading">
                  <strong>Selected plugin</strong>
                  <span>{activePlugin.name}</span>
                </div>
                <div className="pluginCommandGrid">
                  <CommandCard
                    command={activePlugin.commands.slashInstall}
                    copiedKey={copiedKey}
                    copyError={copyError}
                    onCopy={copyValue}
                  />
                  <CommandCard
                    command={activePlugin.commands.cliInstall}
                    copiedKey={copiedKey}
                    copyError={copyError}
                    onCopy={copyValue}
                  />
                  <CommandCard
                    command={activePlugin.commands.sessionLoad}
                    copiedKey={copiedKey}
                    copyError={copyError}
                    onCopy={copyValue}
                  />
                  <CommandCard
                    command={activePlugin.commands.localDev}
                    copiedKey={copiedKey}
                    copyError={copyError}
                    onCopy={copyValue}
                  />
                </div>
              </div>

              <div className="tags">
                <span className="badge">{activePlugin.hub?.status ?? 'unknown'}</span>
                <span className="badge">{activePlugin.hub?.provenance?.type ?? 'unknown provenance'}</span>
                {(activePlugin.tags ?? []).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>

              <div className="metaGrid">
                <div>
                  <strong>Source</strong>
                  <span>{activePlugin.source}</span>
                </div>
                <div>
                  <strong>Maintainer</strong>
                  <span>{activePlugin.hub?.maintainer?.name ?? activePlugin.author?.name ?? 'Unknown'}</span>
                </div>
                <div>
                  <strong>License</strong>
                  <span>{activePlugin.hub?.provenance?.license ?? activePlugin.license ?? 'Unspecified'}</span>
                </div>
                <div>
                  <strong>Inventory</strong>
                  <span>
                    <ShieldCheck size={15} />
                    {activePlugin.inventory.skills} skills · {activePlugin.inventory.scripts} scripts ·{' '}
                    {activePlugin.inventory.files} files
                  </span>
                </div>
              </div>

              {activePlugin.hub?.useCases?.length ? (
                <div className="textPanel">
                  <h3>Use cases</h3>
                  <ul>
                    {activePlugin.hub.useCases.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {activePlugin.hub?.warnings?.length ? (
                <div className="textPanel warningPanel">
                  <h3>Warnings</h3>
                  <ul>
                    {activePlugin.hub.warnings.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <div className="emptyState">Select a plugin to inspect details.</div>
          )}
        </section>

        <section className="explorer" aria-label="Plugin file explorer">
          <div className="explorerTree">
            <div className="panelHeader">
              <strong>Files</strong>
              <span>{activePlugin ? `plugins/${activePlugin.name}` : 'no plugin'}</span>
            </div>
            {visibleEntries.length ? (
              <div className="treeList">
                {visibleEntries.map((entry) => (
                  <button
                    className={entry.path === selectedFile ? 'treeRow selected' : 'treeRow'}
                    key={`${entry.type}:${entry.path}`}
                    style={{ paddingLeft: 10 + depthOf(entry.path) * 14 }}
                    type="button"
                    onClick={() =>
                      entry.type === 'directory' ? toggleFolder(entry.path) : selectFile(entry.path)
                    }
                  >
                    {entry.type === 'directory' ? (
                      openFolders.has(entry.path) ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    ) : (
                      <File size={14} />
                    )}
                    {entry.type === 'directory' ? <Folder size={14} /> : null}
                    <span>{entry.path.split('/').at(-1)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="emptyState">No previewable tree.</div>
            )}
          </div>

          <div className="previewPane">
            <div className="panelHeader">
              <strong>{selectedFile ?? 'No file selected'}</strong>
              <div className="previewActions">
                {selectedFile ? (
                  <button type="button" onClick={() => copyValue(selectedFile, `path:${selectedFile}`)}>
                    {copiedKey === `path:${selectedFile}` ? <Check size={14} /> : <Copy size={14} />}
                    path
                  </button>
                ) : null}
                {selectedEntry ? (
                  <a href={selectedEntry.githubUrl} rel="noreferrer">
                    <ExternalLink size={14} />
                    GitHub
                  </a>
                ) : null}
              </div>
            </div>

            {selectedEntry && selectedContent ? (
              <>
                <div className="fileMeta">
                  {formatSize(selectedEntry.size)} · {selectedEntry.extension || 'text'}
                </div>
                <pre className="codePreview">{selectedContent}</pre>
                <button
                  className="copyContent"
                  type="button"
                  onClick={() => copyValue(selectedContent, `content:${selectedFile}`)}
                >
                  {copiedKey === `content:${selectedFile}` ? <Check size={15} /> : <Copy size={15} />}
                  copy content
                </button>
              </>
            ) : selectedEntry ? (
              <div className="emptyState">
                {selectedEntry.isLarge || !selectedEntry.isText
                  ? 'Preview unavailable for binary or large files.'
                  : 'File content is not in the generated catalog.'}
                <a href={selectedEntry.rawUrl} target="_blank" rel="noreferrer">
                  view raw
                </a>
              </div>
            ) : activePlugin ? (
              <div className="emptyState">This plugin has no default preview file.</div>
            ) : (
              <div className="emptyState">Load a plugin to browse files.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
