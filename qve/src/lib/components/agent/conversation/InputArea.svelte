<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { AgentAction } from '$lib/agent/types';
  import { awaitingFieldCorrection } from '$stores';

  export let phase: string = 'greeting';
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  let inputValue = '';
  let cameraInput: HTMLInputElement = undefined!;
  let galleryInput: HTMLInputElement = undefined!;
  let textareaEl: HTMLTextAreaElement = undefined!;
  let showImageMenu = false;
  let cameraBtnEl: HTMLButtonElement = undefined!;

  // Auto-resize textarea on input (no reactive statement to avoid loops)
  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${textareaEl.scrollHeight}px`;
  }

  // Phases where input is disabled
  const disabledPhases = ['identifying', 'complete', 'confirm_new_search'];
  $: isDisabled = disabled || disabledPhases.includes(phase);

  // Dynamic placeholder based on phase (kept concise to avoid wrapping)
  const placeholders: Record<string, string> = {
    greeting: 'Wine name or photo...',
    awaiting_input: 'Wine name or photo...',
    identifying: 'Processing...',
    confirming: 'Search again...',
    adding_wine: 'Continue...',
    enriching: 'Loading...',
    error: 'Try again...',
    complete: 'Processing...',
  };

  const fieldLabels: Record<string, string> = {
    producer: 'producer',
    wineName: 'wine name',
    vintage: 'vintage',
    region: 'region',
    country: 'country',
    type: 'type',
  };

  $: basePlaceholder = placeholders[phase] ?? 'Type a message...';
  $: placeholder = $awaitingFieldCorrection
    ? `Enter correct ${fieldLabels[$awaitingFieldCorrection] ?? 'value'}...`
    : basePlaceholder;

  function handleSubmit() {
    const text = inputValue.trim();
    if (!text || isDisabled) return;

    dispatch('action', { type: 'submit_text', payload: text });
    inputValue = '';
    // Reset height after clearing
    if (textareaEl) textareaEl.style.height = 'auto';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  /**
   * Compress image for upload. Uses createImageBitmap with resize options
   * when available (Safari 15+) to avoid decoding the full-resolution photo
   * in memory (~48MB for 12MP). Falls back to FileReader + canvas.
   */
  async function compressImage(file: File): Promise<{ data: string; mimeType: string }> {
    const MAX_DIM = 1024;
    const QUALITY = 0.80;

    // Try createImageBitmap (decodes + resizes in native code, much less JS memory)
    if (typeof createImageBitmap === 'function') {
      try {
        return await compressWithBitmap(file, MAX_DIM, QUALITY);
      } catch {
        // Fall through to FileReader approach
      }
    }

    return compressWithFileReader(file, MAX_DIM, QUALITY);
  }

  async function compressWithBitmap(
    file: File,
    maxDim: number,
    quality: number
  ): Promise<{ data: string; mimeType: string }> {
    // Get dimensions from a full bitmap, close immediately
    const probe = await createImageBitmap(file);
    let { width, height } = probe;
    probe.close();

    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Decode at target resolution — browser handles resize in native code
    const bitmap = await createImageBitmap(file, {
      resizeWidth: width,
      resizeHeight: height,
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas context');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    canvas.width = 0;
    canvas.height = 0;

    return { data: dataUrl, mimeType: 'image/jpeg' };
  }

  function compressWithFileReader(
    file: File,
    maxDim: number,
    quality: number
  ): Promise<{ data: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No canvas context')); return; }

          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', quality);

          // Release memory
          canvas.width = 0;
          canvas.height = 0;
          img.src = '';

          resolve({ data: dataUrl, mimeType: 'image/jpeg' });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function handleImageSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Reset file inputs immediately (before async work)
    if (cameraInput) cameraInput.value = '';
    if (galleryInput) galleryInput.value = '';

    try {
      const compressed = await compressImage(file);
      dispatch('action', {
        type: 'submit_image',
        payload: compressed,
      });
    } catch (err) {
      console.error('[InputArea] Image compression failed:', err);
    }
  }

  function toggleImageMenu() {
    showImageMenu = !showImageMenu;
  }

  function takePhoto() {
    showImageMenu = false;
    cameraInput?.click();
  }

  function uploadImage() {
    showImageMenu = false;
    galleryInput?.click();
  }

  function handleClickOutside(e: MouseEvent) {
    if (!showImageMenu) return;
    const target = e.target as Node;
    if (cameraBtnEl?.contains(target)) return;
    const menu = document.querySelector('.image-menu');
    if (menu?.contains(target)) return;
    showImageMenu = false;
  }

  // Close menu on outside click
  $: if (typeof document !== 'undefined') {
    if (showImageMenu) {
      document.addEventListener('click', handleClickOutside, true);
    } else {
      document.removeEventListener('click', handleClickOutside, true);
    }
  }

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleClickOutside, true);
    }
  });

  // Handle focus - scroll input into view for mobile keyboards
  function handleFocus() {
    // Small delay to let keyboard animate in
    setTimeout(() => {
      textareaEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }
</script>

<div class="input-area" class:disabled={isDisabled}>
  <div class="input-wrapper">
    <textarea
      bind:value={inputValue}
      bind:this={textareaEl}
      {placeholder}
      disabled={isDisabled}
      on:keydown={handleKeydown}
      on:input={autoResize}
      on:focus={handleFocus}
      rows="1"
      class="input-field"
    ></textarea>
  </div>

  <div class="input-actions">
    <div class="camera-wrapper">
      <button
        type="button"
        class="action-btn camera-btn"
        bind:this={cameraBtnEl}
        on:click={toggleImageMenu}
        disabled={isDisabled}
        aria-label="Take photo or upload image"
        aria-expanded={showImageMenu}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>

      {#if showImageMenu}
        <div class="image-menu" role="menu">
          <button class="image-menu-item" role="menuitem" on:click={takePhoto}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Take Photo
          </button>
          <button class="image-menu-item" role="menuitem" on:click={uploadImage}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            Upload Image
          </button>
        </div>
      {/if}
    </div>

    <button
      type="button"
      class="action-btn send-btn"
      on:click={handleSubmit}
      disabled={isDisabled || !inputValue.trim()}
      aria-label="Send message"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    </button>
  </div>

  <!-- Camera capture (with capture attribute for native camera) -->
  <input
    type="file"
    accept="image/*"
    capture="environment"
    bind:this={cameraInput}
    on:change={handleImageSelect}
    hidden
  />
  <!-- Gallery/file upload (no capture attribute) -->
  <input
    type="file"
    accept="image/*"
    bind:this={galleryInput}
    on:change={handleImageSelect}
    hidden
  />
</div>

<style>
  .input-area {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--surface);
    border-top: 1px solid var(--divider);
  }

  .input-area.disabled {
    opacity: 0.6;
  }

  .input-wrapper {
    flex: 1;
  }

  .input-field {
    width: 100%;
    min-height: 44px;
    max-height: 120px;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text-primary);
    font-size: 1rem;
    font-family: var(--font-sans);
    resize: none;
    outline: none;
    transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
  }

  .input-field:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-muted);
  }

  .input-field:disabled {
    background: var(--bg-subtle);
    color: var(--text-tertiary);
    cursor: not-allowed;
  }

  .input-field::placeholder {
    color: var(--text-tertiary);
  }

  .input-actions {
    display: flex;
    gap: var(--space-1);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--divider-subtle);
    border-radius: var(--radius-lg);
    background: var(--bg-subtle);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
  }

  .action-btn:hover:not(:disabled) {
    background: var(--accent-muted);
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .action-btn:active:not(:disabled) {
    transform: scale(0.96);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Send button - prominent accent style */
  .send-btn:not(:disabled) {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
  }

  .send-btn:hover:not(:disabled) {
    background: var(--accent-subtle);
    border-color: var(--accent-subtle);
  }

  /* Camera menu popover */
  .camera-wrapper {
    position: relative;
  }

  .image-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    display: flex;
    flex-direction: column;
    min-width: 170px;
    padding: var(--space-1);
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    z-index: 10;
    animation: menu-appear 0.15s var(--ease-out);
  }

  @keyframes menu-appear {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .image-menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-primary);
    font-size: 0.9rem;
    font-family: var(--font-sans);
    cursor: pointer;
    transition: background 0.15s var(--ease-out);
    white-space: nowrap;
  }

  .image-menu-item:hover {
    background: var(--accent-muted);
  }

  .image-menu-item:active {
    background: var(--accent-muted);
    transform: scale(0.98);
  }

  .image-menu-item svg {
    flex-shrink: 0;
    color: var(--text-secondary);
  }
</style>
