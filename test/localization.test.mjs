import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LANGUAGES,
  resolveLanguage,
  t,
  translations,
} from '../src/localization.ts'

test('resolveLanguage prefers saved language, then browser language, then English', () => {
  assert.equal(resolveLanguage('zh', ['en-US']), 'zh')
  assert.equal(resolveLanguage('en', ['zh-CN']), 'en')
  assert.equal(resolveLanguage(null, ['zh-CN', 'en-US']), 'zh')
  assert.equal(resolveLanguage(undefined, ['fr-FR']), 'en')
})

test('web UI labels are localized in every supported language', () => {
  for (const language of LANGUAGES) {
    assert.equal(typeof t(language, 'globalSetupTitle'), 'string')
    assert.notEqual(t(language, 'globalSetupTitle'), '')
    assert.equal(typeof t(language, 'searchPlaceholder'), 'string')
    assert.notEqual(t(language, 'searchPlaceholder'), '')
  }

  assert.equal(t('en', 'globalSetupTitle'), 'Global setup')
  assert.equal(t('zh', 'globalSetupTitle'), '全局设置')
})

test('localization table only covers hub UI chrome, not catalog/plugin content', () => {
  const blockedCatalogKeys = ['pluginNames', 'pluginDescriptions', 'pluginUseCases', 'pluginWarnings', 'catalogEntries']

  for (const language of LANGUAGES) {
    for (const key of blockedCatalogKeys) {
      assert.equal(Object.hasOwn(translations[language], key), false)
    }
  }
})
