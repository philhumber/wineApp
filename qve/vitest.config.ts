import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	resolve: {
		// Force browser/client versions instead of server versions
		conditions: ['browser', 'import', 'module', 'default'],
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/test-setup.ts'],
		alias: {
			$lib: path.resolve(__dirname, './src/lib'),
			$app: path.resolve(__dirname, './src/app-mocks'),
			$api: path.resolve(__dirname, './src/lib/api'),
			$stores: path.resolve(__dirname, './src/lib/stores'),
			$styles: path.resolve(__dirname, './src/lib/styles'),
			$components: path.resolve(__dirname, './src/lib/components'),
			$utils: path.resolve(__dirname, './src/lib/utils'),
			'$env/static/public': path.resolve(__dirname, './src/app-mocks/env-static-public.ts'),
		},
	},
});
