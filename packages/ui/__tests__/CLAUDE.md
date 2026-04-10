# UI Testing

## WebGPU / Browser Testing

Playwright headless Chrome does not support WebGPU. To test the UI visually (e.g. video rendering on canvas), use `agent-browser` with a real Chrome instance that has remote debugging enabled.

Enable Chrome remote debugging via `chrome://inspect` (default `127.0.0.1:9222`), then start the UI server.

### Usage

```bash
agent-browser --auto-connect open http://localhost:4800
agent-browser --auto-connect screenshot /tmp/screenshot.png
agent-browser --auto-connect eval "document.querySelector('video').videoWidth"
```

Also supports `snapshot` (a11y tree), `upload`, and `--cdp <port>` for explicit connection.

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
