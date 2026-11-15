import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const CESIUM = 'node_modules/cesium/Build/Cesium'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Cesium loads workers, shaders and star textures at runtime from CESIUM_BASE_URL.
    viteStaticCopy({
      targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((dir) => ({
        src: `${CESIUM}/${dir}`,
        dest: 'cesium',
        rename: { stripBase: 4 }, // drop node_modules/cesium/Build/Cesium/ → cesium/Assets/...
      })),
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
