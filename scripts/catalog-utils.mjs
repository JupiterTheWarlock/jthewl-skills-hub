import path from 'node:path'

export const REPO_OWNER = 'JupiterTheWarlock'
export const REPO_NAME = 'jthewl-skills'
export const MARKETPLACE_NAME = 'jthewl-skills'
export const PUBLIC_BASE_URL = 'https://jthewl.cc'
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`
export const RAW_BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main`

const DEFAULT_PREVIEW_ORDER = [
  (entry) => entry.path === 'README.md',
  (entry) => /^skills\/[^/]+\/SKILL\.md$/.test(entry.path),
  (entry) => entry.path === '.claude-plugin/plugin.json',
  (entry) => entry.type === 'file' && entry.isText,
]

export function toPosixPath(value) {
  return value.split(path.sep).join('/')
}

export function cleanSource(source) {
  return source.replace(/^\.\//, '').replace(/\/$/, '')
}

export function buildCommandSet(pluginName) {
  return {
    slashInstall: `/plugin install ${pluginName}@${MARKETPLACE_NAME}`,
    cliInstall: `claude plugin install ${pluginName}@${MARKETPLACE_NAME}`,
    sessionLoad: `claude --plugin-url ${PUBLIC_BASE_URL}/plugins/${pluginName}.zip`,
    localDev: `claude --plugin-dir ./plugins/${pluginName}`,
  }
}

export function sortTreeEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftParts = left.path.split('/')
    const rightParts = right.path.split('/')
    const limit = Math.min(leftParts.length, rightParts.length)

    for (let index = 0; index < limit; index += 1) {
      if (leftParts[index] !== rightParts[index]) {
        return leftParts[index].localeCompare(rightParts[index], 'en')
      }
    }

    if (leftParts.length !== rightParts.length) {
      return leftParts.length - rightParts.length
    }

    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
    return 0
  })
}

export function chooseDefaultPreview(entries) {
  for (const matcher of DEFAULT_PREVIEW_ORDER) {
    const match = entries.find((entry) => matcher(entry))
    if (match) return match.path
  }
  return null
}

export function githubFileUrl(source, filePath) {
  return `${REPO_URL}/blob/main/${cleanSource(source)}/${filePath}`
}

export function rawFileUrl(source, filePath) {
  return `${RAW_BASE_URL}/${cleanSource(source)}/${filePath}`
}
