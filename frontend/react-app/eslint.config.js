import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // The data-loading idiom used across this app — useEffect(() => { void
      // load() }, [load]) and resetting dependent state when inputs change —
      // legitimately calls setState from effects (after an await, not
      // synchronously in a render-causing way). This rule is an opinionated
      // perf hint, not a correctness check, so we disable it project-wide.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
