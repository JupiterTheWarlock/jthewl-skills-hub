import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildCommandSet,
  chooseDefaultPreview,
  cleanSource,
  githubFileUrl,
  rawFileUrl,
  REPO_URL,
  sortTreeEntries,
  toPosixPath,
} from './catalog-utils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hubRoot = path.resolve(__dirname, '..')
const skillsRoot = path.resolve(hubRoot, '..', 'jthewl-skills')
const defaultConsensusProfilePath = path.resolve(
  hubRoot,
  '..',
  '.agents',
  'skills',
  'jthewl-personal-consensus',
  'data',
  'profile.json',
)
const consensusProfilePath = process.env.CONSENSUS_PROFILE_PATH ?? defaultConsensusProfilePath
const marketplacePath = path.join(skillsRoot, '.claude-plugin', 'marketplace.json')
const hubMetadataRoot = path.join(skillsRoot, '.jthewl-hub', 'plugins')
const outputPath = path.join(hubRoot, 'public', 'data', 'catalog.json')
const optionalMode = process.argv.includes('--if-present')
const fallbackSkillsRepoUrl = 'https://github.com/JupiterTheWarlock/jthewl-skills.git'

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.sh',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
])
const LARGE_FILE_LIMIT = 250 * 1024
const EXCLUDED_NAMES = new Set(['.git', 'node_modules', '.env', '.env.local', 'dist', 'build', '.cache'])

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

async function readOptionalJson(filePath) {
  try {
    return await readJson(filePath)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function readBrandProfile() {
  const profile = await readOptionalJson(consensusProfilePath)
  if (profile) return profile

  const existingCatalog = await readOptionalJson(outputPath)
  if (existingCatalog?.brand) {
    console.warn(`Consensus profile missing at ${consensusProfilePath}; reusing brand data from ${path.relative(hubRoot, outputPath)}`)
    return {
      identity: existingCatalog.brand.identity,
      avatar: existingCatalog.brand.avatar,
      color_scheme: existingCatalog.brand.colorScheme,
      social: existingCatalog.brand.social,
    }
  }

  throw new Error(`Consensus profile missing at ${consensusProfilePath} and no catalog brand fallback exists`)
}

function latestCommitDate(pluginSource) {
  try {
    return execFileSync('git', ['-C', skillsRoot, 'log', '-1', '--format=%cs', '--', cleanSource(pluginSource)], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return null
  }
}

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

async function scanPluginTree(pluginRoot, source) {
  const entries = []
  const previewContents = {}

  async function walk(currentDir, relativeDir = '') {
    const children = await readdir(currentDir, { withFileTypes: true })

    for (const child of children) {
      if (EXCLUDED_NAMES.has(child.name) || child.name.startsWith('.env')) continue

      const absolutePath = path.join(currentDir, child.name)
      const relativePath = toPosixPath(path.join(relativeDir, child.name))

      if (child.isDirectory()) {
        entries.push({ path: relativePath, type: 'directory' })
        await walk(absolutePath, relativePath)
        continue
      }

      if (!child.isFile()) continue

      const fileStat = await stat(absolutePath)
      const text = isTextFile(relativePath)
      const entry = {
        path: relativePath,
        type: 'file',
        size: fileStat.size,
        extension: path.extname(relativePath).replace(/^\./, ''),
        isText: text,
        isLarge: fileStat.size > LARGE_FILE_LIMIT,
        rawUrl: rawFileUrl(source, relativePath),
        githubUrl: githubFileUrl(source, relativePath),
      }
      entries.push(entry)

      if (text && fileStat.size <= LARGE_FILE_LIMIT) {
        previewContents[relativePath] = await readFile(absolutePath, 'utf8')
      }
    }
  }

  await walk(pluginRoot)
  const sortedEntries = sortTreeEntries(entries)

  return {
    tree: sortedEntries,
    defaultPreview: chooseDefaultPreview(sortedEntries),
    previewContents,
  }
}

function componentInventory(tree) {
  return {
    manifests: tree.filter((entry) => entry.type === 'file' && entry.path.endsWith('plugin.json')).length,
    skills: tree.filter((entry) => entry.type === 'file' && entry.path.endsWith('/SKILL.md')).length,
    scripts: tree.filter((entry) => entry.type === 'file' && /\/scripts\//.test(entry.path)).length,
    files: tree.filter((entry) => entry.type === 'file').length,
  }
}

async function buildCatalog() {
  let activeSkillsRoot = skillsRoot
  let activeMarketplacePath = marketplacePath
  let activeHubMetadataRoot = hubMetadataRoot
  let cleanupTempDir = null

  const hasMarketplace = await stat(activeMarketplacePath).then(() => true, () => false)
  if (!hasMarketplace) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'jthewl-skills-hub-'))
    const cloneTarget = path.join(tempDir, 'jthewl-skills')
    execFileSync('git', ['clone', '--depth', '1', fallbackSkillsRepoUrl, cloneTarget], { stdio: 'inherit' })
    activeSkillsRoot = cloneTarget
    activeMarketplacePath = path.join(activeSkillsRoot, '.claude-plugin', 'marketplace.json')
    activeHubMetadataRoot = path.join(activeSkillsRoot, '.jthewl-hub', 'plugins')
    cleanupTempDir = tempDir
    console.log('Using cloned jthewl-skills repository for catalog generation')
  }

  if (optionalMode && !hasMarketplace) {
    console.log('Optional mode: sibling marketplace missing, switched to remote clone')
  }

  const [marketplace, profile] = await Promise.all([readJson(activeMarketplacePath), readBrandProfile()])

  const plugins = await Promise.all(
    marketplace.plugins.map(async (plugin) => {
      const source = cleanSource(plugin.source)
      const pluginRoot = path.join(activeSkillsRoot, source)
      const [pluginManifest, hubMetadata] = await Promise.all([
        readOptionalJson(path.join(pluginRoot, '.claude-plugin', 'plugin.json')),
        readOptionalJson(path.join(activeHubMetadataRoot, `${plugin.name}.json`)),
      ])
      const scanned = await scanPluginTree(pluginRoot, source)

      return {
        ...plugin,
        source,
        hub: hubMetadata,
        runtimeManifest: pluginManifest,
        commands: buildCommandSet(plugin.name),
        updatedAt: hubMetadata?.updatedAt ?? latestCommitDate(source),
        zipUrl: `https://jthewl.cc/plugins/${plugin.name}.zip`,
        githubUrl: `${REPO_URL}/tree/main/${source}`,
        fileTree: scanned.tree,
        defaultPreview: scanned.defaultPreview,
        previewContents: scanned.previewContents,
        inventory: componentInventory(scanned.tree),
      }
    }),
  )

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: {
      repository: REPO_URL,
      marketplacePath: '.claude-plugin/marketplace.json',
    },
    brand: {
      identity: profile.identity,
      avatar: profile.avatar,
      colorScheme: profile.color_scheme,
      social: profile.social,
    },
    marketplace: {
      name: marketplace.name,
      description: marketplace.description,
      version: marketplace.version,
      owner: marketplace.owner,
    },
    commands: {
      marketplaceAdd: '/plugin marketplace add JupiterTheWarlock/jthewl-skills',
      cliMarketplaceAdd: 'claude plugin marketplace add JupiterTheWarlock/jthewl-skills',
    },
    plugins,
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${path.relative(hubRoot, outputPath)} with ${plugins.length} plugins`)

  if (cleanupTempDir) {
    await rm(cleanupTempDir, { recursive: true, force: true })
  }
}

buildCatalog().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
