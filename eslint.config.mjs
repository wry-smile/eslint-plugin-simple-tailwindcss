import eslintConfig from '@antfu/eslint-config'
import simpleTailwind from './dist/index.js'

export default eslintConfig({
  typescript: true,
  vue: true,
  formatter: true,
  plugins: {
    'simple-tailwindcss': simpleTailwind,
  },
  rules: {
    "simple-tailwindcss/sort-classes": "error",
  },
});
