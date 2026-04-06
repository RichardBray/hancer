# UI Testing

## WebGPU / Browser Testing

Playwright headless Chrome does not support WebGPU. To test the UI visually (e.g. video rendering on canvas), use `agent-browser` with a real Chrome instance that has remote debugging enabled.

### Setup

1. Open Chrome with remote debugging enabled, or enable it via `chrome://inspect` > "Allow remote debugging for this browser instance" (default port `127.0.0.1:9222`)
2. Start the UI server: `bun run packages/cli/src/cli.ts ui`

### Usage

```bash
# Auto-discover and connect to running Chrome
agent-browser --auto-connect open http://localhost:4800

# Or connect via explicit CDP port
agent-browser --cdp 9222 open http://localhost:4800

# Take screenshots
agent-browser --auto-connect screenshot /tmp/screenshot.png

# Get accessibility snapshot (useful for finding elements)
agent-browser --auto-connect snapshot

# Run JS in the browser
agent-browser --auto-connect eval "document.querySelector('video').videoWidth"

# Upload files (requires a visible input element or JS workaround)
agent-browser --auto-connect upload "input[type=file]" /path/to/file.mov
```

### File uploads with dynamic inputs

The `UploadZone` component creates file inputs dynamically on click (no persistent `<input>` in the DOM). To upload via agent-browser, inject an input and dispatch a drop event:

```bash
# 1. Create a temporary file input
agent-browser --auto-connect eval "
  const input = document.createElement('input');
  input.type = 'file'; input.id = '__test_upload';
  input.style.display = 'none';
  document.body.appendChild(input);
"

# 2. Upload the file
agent-browser --auto-connect upload "#__test_upload" /path/to/video.mov

# 3. Dispatch drop event to trigger React handler
agent-browser --auto-connect eval "
  const input = document.querySelector('#__test_upload');
  const file = input.files[0];
  const dropZone = document.querySelector('[class*=\"border-dashed\"]');
  const dt = new DataTransfer();
  dt.items.add(file);
  dropZone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
"
```

### Rebuilding the UI

The UI server serves pre-built static files from `packages/ui/dist/`. Source changes require a rebuild:

```bash
bun run build:ui
```

Then restart the UI server process for changes to take effect.
