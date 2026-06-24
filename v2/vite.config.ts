import { defineConfig, Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// main.ts のトップレベル関数を全て window に自動公開するプラグイン
// これにより onclick="xxx()" が常に動作する（手動管理不要）
function autoWindowExpose(): Plugin {
  return {
    name: 'auto-window-expose',
    transform(code: string, id: string) {
      if (!id.endsWith('main.ts')) return null;
      const names = [...code.matchAll(/^(?:async )?function (\w+)/gm)]
        .map(m => m[1]);
      if (!names.length) return null;
      const expose = `\n// auto-exposed by vite plugin\nObject.assign(window,{${names.join(',')}});\n`;
      return { code: code + expose, map: null };
    },
  };
}

export default defineConfig({
  plugins: [autoWindowExpose(), viteSingleFile()],
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    emptyOutDir: true,
  },
});
