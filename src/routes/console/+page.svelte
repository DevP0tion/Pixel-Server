<script lang="ts">
	import { onMount } from 'svelte';
	import { source } from 'sveltekit-sse';
	import type { PageProps } from './$types';
	import { handleSvelteCommand } from './console.client';
	import { _log } from './console.remote';
	import type { LogEntry, LogType } from '$lib/server/logger';

	let { data }: PageProps = $props();

	let logs: LogEntry[] = $state([]);
	let commandInput = $state('');
	let isUnityConnected = $state(false);
	let logContainer: HTMLDivElement | null = $state(null);
	let autoScroll = $state(true);
	let commandTarget: LogType = $state('svelte');
	let selectedUnityServer = $state('all');
	let connectedUnityServers: Array<{ id: string; name: string }> = $state([]);

	let unityServerOptions = $derived([{ id: 'all', name: '모든 서버' }, ...connectedUnityServers]);

	// 로그 필터
	let filterUnity = $state(true);
	let filterSvelte = $state(true);

	let filteredLogs = $derived(
		logs.filter((log) => {
			if (log.type === 'unity' && !filterUnity) return false;
			if (log.type === 'svelte' && !filterSvelte) return false;
			return true;
		})
	);

	function sendCommand(input: string = commandInput) {
		if (commandTarget === 'svelte') {
			handleSvelteCommand(input);
		}

		commandInput = '';
	}

	onMount(() => {
		// 초기 로그 로드
		logs = data.logs;

		console.log('Initial logs loaded:', $state.snapshot(logs));

		const unsubscribe = source('/console')
			.select('new-log')
			.subscribe((logJson) => {
				if (!logJson) return;
				const log: {
					type: LogType;
					message: string;
					timestamp: string;
				} = JSON.parse(logJson);

				logs = [...logs, { ...log, timestamp: new Date(log.timestamp) }];
			});

		return () => unsubscribe();
	});
</script>

<svelte:head>
	<title>Console - Pixel Server</title>
</svelte:head>

<div class="console-container">
	<!-- 헤더 -->
	<header class="header">
		<div class="header-left">
			<h1>Pixel Server Console</h1>
			<div class="connection-status">
				<div class="status-item">
					<span class="status-indicator" class:connected={isUnityConnected}></span>
					<span class="status-text">Unity: {isUnityConnected ? '연결됨' : '연결 끊김'}</span>
				</div>
			</div>
		</div>
		<div class="header-right">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={autoScroll} />
				자동 스크롤
			</label>
		</div>
	</header>

	<!-- 범례 (토글 버튼) -->
	<div class="legend">
		<button
			class="toggle-btn toggle-unity"
			class:active={filterUnity}
			onclick={() => (filterUnity = !filterUnity)}
		>
			[Unity] Unity 서버
		</button>
		<button
			class="toggle-btn toggle-svelte"
			class:active={filterSvelte}
			onclick={() => (filterSvelte = !filterSvelte)}
		>
			[Svelte] Svelte 서버
		</button>
	</div>

	<!-- 로그 영역 -->
	<div bind:this={logContainer} class="log-container">
		{#each filteredLogs as log (log.timestamp)}
			<div class="log-entry">
				<span class="log-time">{log.timestamp.toLocaleTimeString()}</span>
				<span class="log-prefix {'log-' + log.type}">[{log.type}]</span>
				<span class="log-message">{log.message}</span>
			</div>
		{/each}
	</div>

	<!-- 명령어 입력 -->
	<div class="input-container">
		<div class="input-wrapper">
			<div class="target-selector">
				<select bind:value={commandTarget} class="target-dropdown">
					<option value="unity">Unity</option>
					<option value="svelte">Svelte</option>
				</select>
				{#if commandTarget === 'unity'}
					<select bind:value={selectedUnityServer} class="unity-server-dropdown">
						{#each unityServerOptions as server (server.id)}
							<option value={server.id}>{server.name}</option>
						{/each}
					</select>
				{/if}
				<span class="prompt">$</span>
			</div>
			<input
				type="text"
				bind:value={commandInput}
				onkeydown={(e) => {
					if (e.key === 'Enter') sendCommand(commandInput);
				}}
				placeholder={commandTarget === 'svelte'
					? 'Svelte 콘솔 명령어 입력... (help, clear, status 등)'
					: 'Unity 서버 명령어 입력...'}
				class="command-input"
			/>
			<button class="btn btn-success" onclick={() => sendCommand(commandInput)}>전송</button>
		</div>
	</div>
</div>

<style lang="scss">
	@use 'sass:color';

	$bg-main: #1a1a2e;
	$bg-panel: #16213e;
	$bg-surface: #0f3460;
	$border: #0f3460;
	$text: #ecf0f1;
	$text-muted: #a0a0a0;

	$accent-green: #2ecc71;
	$accent-blue: #3498db;
	$accent-magenta: #9b59b6;
	$accent-gray: #34495e;

	$font-code: 'Consolas', 'Monaco', 'Courier New', monospace;

	$log-colors: (
		unity: $accent-green,
		svelte: $accent-blue
	);

	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background-color: $bg-main;
		color: $text;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	%dropdown {
		padding: 6px 12px;
		background-color: $bg-surface;
		border: 1px solid $accent-green;
		border-radius: 4px;
		color: $accent-green;
		font-family: $font-code;
		font-size: 0.875rem;
		font-weight: 700;
		cursor: pointer;
		outline: none;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			color 0.2s ease;

		&:hover {
			background-color: $bg-panel;
		}

		&:focus {
			border-color: $accent-blue;
			box-shadow: 0 0 0 2px rgba($accent-blue, 0.2);
		}

		option {
			background-color: $bg-panel;
			color: $text;
		}
	}

	.console-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background-color: $bg-main;
		color: $text;

		.header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 12px 16px;
			background-color: $bg-panel;
			border-bottom: 1px solid $border;

			.header-left {
				display: flex;
				align-items: center;
				gap: 16px;

				h1 {
					margin: 0;
					font-size: 1.25rem;
					font-weight: 700;
				}

				.connection-status {
					display: flex;
					align-items: center;
					gap: 16px;

					.status-item {
						display: flex;
						align-items: center;
						gap: 6px;

						.status-indicator {
							width: 10px;
							height: 10px;
							border-radius: 50%;
							background-color: #e74c3c;

							&.connected {
								background-color: $accent-green;
							}
						}

						.status-text {
							font-size: 0.75rem;
							color: $text-muted;
						}
					}
				}
			}

			.header-right {
				display: flex;
				align-items: center;
				gap: 12px;

				.checkbox-label {
					display: flex;
					align-items: center;
					gap: 6px;
					font-size: 0.875rem;
					color: $text-muted;
					cursor: pointer;
				}
			}
		}

		.btn {
			padding: 6px 12px;
			border: none;
			border-radius: 4px;
			font-size: 0.875rem;
			cursor: pointer;
			transition:
				background-color 0.2s ease,
				transform 0.12s ease,
				box-shadow 0.12s ease;

			&:hover {
				transform: translateY(-1px);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
			}

			&:active {
				transform: translateY(0);
				box-shadow: none;
			}

			&.btn-primary {
				background-color: $accent-blue;
				color: #fff;

				&:hover {
					background-color: color.adjust($accent-blue, $lightness: -7%);
				}
			}

			&.btn-secondary {
				background-color: $accent-gray;
				color: #fff;

				&:hover {
					background-color: color.adjust($accent-gray, $lightness: -6%);
				}
			}

			&.btn-success {
				background-color: $accent-green;
				color: #fff;

				&:hover {
					background-color: color.adjust($accent-green, $lightness: -6%);
				}
			}
		}

		.legend {
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
			padding: 8px 16px;
			background-color: $bg-panel;
			border-bottom: 1px solid $border;
			font-size: 0.875rem;

			.toggle-btn {
				padding: 6px 12px;
				border: 2px solid currentColor;
				border-radius: 4px;
				font-size: 0.875rem;
				background-color: transparent;
				cursor: pointer;
				transition:
					background-color 0.2s ease,
					opacity 0.2s ease,
					transform 0.12s ease;

				&:hover {
					transform: translateY(-1px);
				}

				&:not(.active) {
					opacity: 0.45;
				}
			}

			@each $type, $color in $log-colors {
				.toggle-#{$type} {
					color: $color;

					&.active {
						background-color: rgba($color, 0.2);
					}
				}
			}
		}

		.log-container {
			flex: 1;
			overflow-y: auto;
			padding: 16px;
			background-color: $bg-main;
			font-family: $font-code;
			font-size: 0.875rem;

			.log-entry {
				display: flex;
				gap: 8px;
				margin-bottom: 4px;
				line-height: 1.5;
				align-items: flex-start;
			}

			.log-time {
				color: $text-muted;
				flex-shrink: 0;
			}

			.log-prefix {
				flex-shrink: 0;
				font-weight: 700;
			}

			@each $type, $color in $log-colors {
				.log-#{$type} {
					color: $color;
				}
			}

			.log-message {
				color: $text;
				word-break: break-all;
				white-space: pre-wrap;
			}

			&::-webkit-scrollbar {
				width: 8px;
			}

			&::-webkit-scrollbar-track {
				background: $bg-main;
			}

			&::-webkit-scrollbar-thumb {
				background: $accent-gray;
				border-radius: 4px;
			}

			&::-webkit-scrollbar-thumb:hover {
				background: color.adjust($accent-gray, $lightness: 8%);
			}
		}

		.input-container {
			padding: 16px;
			background-color: $bg-panel;
			border-top: 1px solid $border;

			.input-wrapper {
				display: flex;
				align-items: center;
				gap: 8px;

				.target-selector {
					display: flex;
					align-items: center;
					gap: 8px;

					.target-dropdown {
						@extend %dropdown;
					}

					.unity-server-dropdown {
						@extend %dropdown;
						border-color: $accent-magenta;
						color: $accent-magenta;

						&:hover {
							border-color: color.adjust($accent-magenta, $lightness: -6%);
						}
					}

					.prompt {
						color: $accent-green;
						font-weight: 700;
						font-family: $font-code;
					}
				}

				.command-input {
					flex: 1;
					padding: 8px;
					background-color: transparent;
					border: none;
					color: $text;
					font-family: $font-code;
					font-size: 0.875rem;
					outline: none;

					&::placeholder {
						color: $text-muted;
					}
				}
			}
		}
	}
</style>
