import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Code2, Copy, ExternalLink, Package, Search, ShieldCheck } from 'lucide-react'
import './App.css'

const MARKETPLACE_URL =
  'https://raw.githubusercontent.com/JupiterTheWarlock/jthewl-skills/main/.claude-plugin/marketplace.json'
const REPO_URL = 'https://github.com/JupiterTheWarlock/jthewl-skills'

type MarketplacePlugin = {
  name: string
  source: string
  description: string
  version: string
  category?: string
  tags?: string[]
  license?: string
}

type Marketplace = {
  name: string
  description: string
  version: string
  plugins: MarketplacePlugin[]
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: Marketplace }
  | { status: 'error'; message: string }

function installCommand(plugin: MarketplacePlugin) {
  return `/plugin install ${plugin.name}@jthewl-skills`
}

function sourceUrl(plugin: MarketplacePlugin) {
  return `${REPO_URL}/tree/main/${plugin.source.replace(/^\.\//, '')}`
}

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [activeName, setActiveName] = useState<string | null>(null)
  const [copiedName, setCopiedName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadMarketplace() {
      try {
        const response = await fetch(MARKETPLACE_URL)
        if (!response.ok) throw new Error(`GitHub raw returned ${response.status}`)
        const data = (await response.json()) as Marketplace
        if (!cancelled) {
          setState({ status: 'ready', data })
          setActiveName(data.plugins[0]?.name ?? null)
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to load marketplace',
          })
        }
      }
    }

    loadMarketplace()
    return () => {
      cancelled = true
    }
  }, [])

  const plugins = useMemo(() => (state.status === 'ready' ? state.data.plugins : []), [state])
  const normalizedQuery = query.trim().toLowerCase()

  const filteredPlugins = useMemo(() => {
    if (!normalizedQuery) return plugins
    return plugins.filter((plugin) =>
      [plugin.name, plugin.description, plugin.category, plugin.license, ...(plugin.tags ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [normalizedQuery, plugins])

  const activePlugin =
    filteredPlugins.find((plugin) => plugin.name === activeName) ?? filteredPlugins[0] ?? null

  async function copyInstall(plugin: MarketplacePlugin) {
    await navigator.clipboard.writeText(installCommand(plugin))
    setCopiedName(plugin.name)
    window.setTimeout(() => setCopiedName(null), 1400)
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">JupiterTheWarlock</p>
          <h1>Skills Hub</h1>
        </div>
        <a className="iconLink" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Open marketplace repository">
          <Code2 size={20} />
        </a>
      </header>

      <section className="summary" aria-label="Marketplace summary">
        <div>
          <span className="metric">{plugins.length}</span>
          <span className="metricLabel">plugins</span>
        </div>
        <div>
          <span className="metric">{state.status === 'ready' ? state.data.version : '-'}</span>
          <span className="metricLabel">marketplace</span>
        </div>
        <div>
          <span className="metric">{state.status === 'ready' ? 'public' : 'syncing'}</span>
          <span className="metricLabel">source</span>
        </div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <label className="searchBox">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search plugins, tags, categories"
              type="search"
            />
          </label>

          {state.status === 'loading' ? <div className="notice">Loading marketplace...</div> : null}
          {state.status === 'error' ? (
            <div className="notice error">
              <AlertCircle size={18} />
              <span>{state.message}</span>
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
                  <small>{plugin.category ?? 'Uncategorized'} · v{plugin.version}</small>
                </span>
              </button>
            ))}
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
                    className="iconButton"
                    type="button"
                    onClick={() => copyInstall(activePlugin)}
                    aria-label="Copy install command"
                    title="Copy install command"
                  >
                    {copiedName === activePlugin.name ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                  <a
                    className="iconButton"
                    href={sourceUrl(activePlugin)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open plugin source"
                    title="Open plugin source"
                  >
                    <ExternalLink size={18} />
                  </a>
                </div>
              </div>

              <p className="description">{activePlugin.description}</p>
              <div className="commandBlock">{installCommand(activePlugin)}</div>

              <div className="tags">
                {(activePlugin.tags ?? []).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>

              <div className="metaGrid">
                <div>
                  <strong>Source</strong>
                  <span>{activePlugin.source}</span>
                </div>
                <div>
                  <strong>Version</strong>
                  <span>{activePlugin.version}</span>
                </div>
                <div>
                  <strong>License</strong>
                  <span>{activePlugin.license ?? 'Unspecified'}</span>
                </div>
                <div>
                  <strong>Safety</strong>
                  <span>
                    <ShieldCheck size={15} /> public skill audit ready
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="emptyState">No matching plugins.</div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
