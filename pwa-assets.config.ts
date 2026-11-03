import { defineConfig, type Preset } from '@vite-pwa/assets-generator/config'

// The logo already keeps its mark inside the maskable safe circle, so the
// generated icons fill the full canvas instead of adding another inset.
const preset: Preset = {
  transparent: {
    sizes: [64, 192, 512],
    favicons: [[48, 'favicon.ico']],
    padding: 0,
  },
  maskable: {
    sizes: [512],
    padding: 0,
  },
  apple: {
    sizes: [180],
    padding: 0,
  },
}

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/logo.svg'],
})
