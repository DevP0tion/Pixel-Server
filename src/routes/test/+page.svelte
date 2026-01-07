<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Test | Executable Check</title>
</svelte:head>

<main class="page">
	<header class="header">
		<h1>Executable Check</h1>
		<p>Checks whether the expected executables exist under dist.</p>
	</header>

	<section class="list" aria-live="polite">
		<div class="row">
			<div class="name">Current Path</div>
			<code class="path">{data.currentPath}</code>
		</div>
		<div class="row">
			<div class="name">Pixel Collector</div>
			<code class="path">{data.collectorExePath}</code>
			<span class:ok={data.collectorExists} class:missing={!data.collectorExists}>
				{data.collectorExists ? 'FOUND' : 'MISSING'}
			</span>
		</div>
	</section>
</main>

<style lang="scss">
	.page {
		max-width: 720px;
		margin: 40px auto;
		padding: 0 20px 32px;
		color: #e8eef7;
	}

	.header {
		margin-bottom: 24px;

		h1 {
			font-size: 28px;
			margin: 0 0 8px;
		}

		p {
			margin: 0;
			color: #a6b3c8;
		}
	}

	.list {
		display: grid;
		gap: 12px;
	}

	.row {
		display: grid;
		grid-template-columns: 140px minmax(0, 1fr) auto;
		gap: 16px;
		align-items: center;
		padding: 12px 16px;
		border: 1px solid #223152;
		border-radius: 10px;
		background: #101a33;
	}

	.name {
		font-weight: 600;
	}

	.path {
		font-family: 'Cascadia Mono', 'Consolas', 'SFMono-Regular', monospace;
		font-size: 13px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: #d7e0ee;
	}

	.ok,
	.missing {
		font-weight: 700;
		font-size: 12px;
		letter-spacing: 0.06em;
		padding: 6px 10px;
		border-radius: 999px;
	}

	.ok {
		color: #b6f2c6;
		background: #113423;
		border: 1px solid #1e6b45;
	}

	.missing {
		color: #f2b6b6;
		background: #3a1414;
		border: 1px solid #7a2a2a;
	}

	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr;
			gap: 8px;
			align-items: flex-start;
		}

		.path {
			white-space: normal;
			word-break: break-all;
		}
	}
</style>
