// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';

// https://astro.build/config
export default defineConfig({
	site: 'https://logoslang.dev',
	integrations: [
		starlight({
			title: 'Λόγος',
			description:
				'Logos is a self-hosting systems language where the compiler, types, proofs, and syntax all live in one structure the language can read and rewrite. Radical unification.',
			// Brand tagline — the Alpha/Omega + self-hosting-seed motif.
			tagline: 'The first and the last language.',
			// Wordmark is the Greek text "Λόγος" set in EB Garamond — styled in src/styles/theme.css
			// (.site-title), not an image, so it stays crisp and selectable.
			plugins: [
				// Emits /llms.txt, /llms-full.txt and /llms-small.txt so LLMs/agents
				// (Claude, Cursor, …) can ingest the docs cleanly.
				starlightLlmsTxt({
					projectName: 'Logos',
					description:
						'A self-hosting systems language built on radical unification: the compiler, types, proofs, and syntax all live in one reflectable, rewritable structure.',
				}),
			],
			customCss: ['./src/styles/theme.css'],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/ThobiasKnudsen/LogosLang' },
			],
			sidebar: [
				{ label: 'Getting started', items: [{ autogenerate: { directory: 'getting-started' } }] },
				{ label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
				{ label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
			],
		}),
	],
});
