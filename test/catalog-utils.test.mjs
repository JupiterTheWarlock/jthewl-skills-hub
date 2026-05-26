import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCommandSet,
  chooseDefaultPreview,
  sortTreeEntries,
} from '../scripts/catalog-utils.mjs'

test('buildCommandSet returns marketplace install and session load commands', () => {
  const commands = buildCommandSet('git-sync')

  assert.equal(commands.slashInstall, '/plugin install git-sync@jthewl-skills')
  assert.equal(commands.cliInstall, 'claude plugin install git-sync@jthewl-skills')
  assert.equal(commands.sessionLoad, 'claude --plugin-url https://jthewl.cc/plugins/git-sync.zip')
  assert.equal(commands.localDev, 'claude --plugin-dir ./plugins/git-sync')
})

test('sortTreeEntries lists directories first, then files by path', () => {
  const sorted = sortTreeEntries([
    { path: 'skills/git-sync/SKILL.md', type: 'file' },
    { path: '.claude-plugin/plugin.json', type: 'file' },
    { path: 'skills', type: 'directory' },
    { path: 'skills/git-sync', type: 'directory' },
  ])

  assert.deepEqual(
    sorted.map((entry) => entry.path),
    ['.claude-plugin/plugin.json', 'skills', 'skills/git-sync', 'skills/git-sync/SKILL.md'],
  )
})

test('sortTreeEntries keeps child files directly under their parent directory', () => {
  const sorted = sortTreeEntries([
    { path: 'skills/xhs-note-scraper/scripts', type: 'directory' },
    { path: '.claude-plugin/plugin.json', type: 'file' },
    { path: 'skills/xhs-note-scraper/SKILL.md', type: 'file' },
    { path: '.claude-plugin', type: 'directory' },
    { path: 'skills', type: 'directory' },
    { path: 'skills/xhs-note-scraper', type: 'directory' },
    { path: 'skills/xhs-note-scraper/scripts/scrape_xhs_note.js', type: 'file' },
  ])

  assert.deepEqual(
    sorted.map((entry) => `${entry.type}:${entry.path}`),
    [
      'directory:.claude-plugin',
      'file:.claude-plugin/plugin.json',
      'directory:skills',
      'directory:skills/xhs-note-scraper',
      'directory:skills/xhs-note-scraper/scripts',
      'file:skills/xhs-note-scraper/scripts/scrape_xhs_note.js',
      'file:skills/xhs-note-scraper/SKILL.md',
    ],
  )
})

test('chooseDefaultPreview follows README, SKILL, plugin manifest, first text priority', () => {
  assert.equal(
    chooseDefaultPreview([
      { path: '.claude-plugin/plugin.json', type: 'file', isText: true },
      { path: 'skills/git-sync/SKILL.md', type: 'file', isText: true },
    ]),
    'skills/git-sync/SKILL.md',
  )

  assert.equal(
    chooseDefaultPreview([
      { path: 'scripts/tool.js', type: 'file', isText: true },
      { path: 'README.md', type: 'file', isText: true },
    ]),
    'README.md',
  )
})
