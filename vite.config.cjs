const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

export default defineConfig({
  plugins: [react()],
  base: './', // هذا السطر سيجعل الـ EXE يقرأ ملفات الـ Assets بشكل صحيح
  build: {
    outDir: 'dist', // للتأكد أن المخرج يطابق ما وضعناه في package.json
  }
})