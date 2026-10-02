# Mockups agent editing protocol

The built-in terminal starts in this live project directory. `project.json` contains `activeId` and the page tree; `canvas.png` is the active page image, and `canvas.json` is its editable stroke array. Do not modify any of these app-managed files directly: the running app will overwrite them.

To edit the ACTIVE page, write one UTF-8 JSON command per file into `agent-inbox/<unique-id>.json`. Write to `.tmp` first, then rename atomically to `.json`. The app checks the inbox roughly every 700 ms. It applies each accepted command to the live canvas with normal undo (Ctrl+Z) and autosave, and writes `agent-results/<same-name>.json` with `{ "ok": true, ... }` or `{ "ok": false, "error": "..." }`. Wait for and check the result before sending the next command. After success, allow about a second for `canvas.png`, `canvas.json`, and `project.json` to refresh.

Commands (replace `PAGE_ID` with `project.json`'s CURRENT `activeId`):

- Import a screenshot/image file: `{ "pageId": "PAGE_ID", "action": "import-image", "path": "C:\\Users\\parkk\\Desktop\\goldstock.png", "x": 100, "y": 100, "width": 1440 }`. **Images ARE supported.** Use this when the user asks to import a website as an image, not a wireframe. First capture the website to a local PNG with your available browser tool, then submit this command and check the result. `path` can be absolute or relative to the project directory; PNG, JPEG and WebP up to 8 MB / 40 million pixels are supported. `width` is optional (defaults to native width); height follows the original aspect ratio. Image bytes are embedded in the project, so the source file is not needed after import. Capturing a website still requires an external browser tool; this command imports an existing file, it does not fetch a URL.
- Add: `{ "pageId": "PAGE_ID", "action": "add", "strokes": [STROKE, ...] }`
- Replace existing objects: `{ "pageId": "PAGE_ID", "action": "replace", "strokes": [COMPLETE_UPDATED_STROKE, ...] }` — each stroke must keep its existing `id`; read `canvas.json` first.
- Delete: `{ "pageId": "PAGE_ID", "action": "delete", "ids": ["EXISTING_STROKE_ID", ...] }`

A stroke needs a unique `id` (use a new UUID for add), `tool` (`pen`, `highlighter`, `line`, `rectangle`, `ellipse`, `triangle`, `text`, or `image`), a six-digit hex `color`, numeric `size`, and `points` with `{ "x": number, "y": number, "pressure": number }`. For a rectangle or ellipse, use two opposite corners. An `image` stroke needs two opposite corners and `imageSource` (a PNG/JPEG/WebP base64 data URL); prefer `import-image` to avoid large command files. Text additionally needs `text` and a font `size` of at least 8; the first point is its top-left corner. Optional fields: `groupId` (same UUID groups multiple strokes), `fill` (hex), `radius`, `locked`, `outlineOnly`. The canvas can extend in any direction; x and y may be negative (the command channel accepts coordinates up to ±10,000,000). Keep pressure within 0–1. `canvas.png` is a finite snapshot encompassing the strokes; if any stroke has negative coordinates, its PNG origin may differ from world coordinate (0, 0), so use `canvas.json` for exact positions. Adding to or changing a locked group is rejected. The app only accepts edits for the page currently open; re-read `project.json` before composing a command.

PowerShell example, adding one rectangle from the built-in terminal:

```powershell
$page = Get-Content project.json -Raw | ConvertFrom-Json
$commandId = [guid]::NewGuid().ToString()
$strokeId = [guid]::NewGuid().ToString()
$request = @{
  pageId = $page.activeId
  action = 'add'
  strokes = @(@{
    id = $strokeId; tool = 'rectangle'; color = '#66e2b8'; size = 3
    points = @(@{ x = 100; y = 150; pressure = 1 }, @{ x = 440; y = 330; pressure = 1 })
  })
} | ConvertTo-Json -Depth 20
$request | Set-Content "agent-inbox/$commandId.tmp" -Encoding UTF8
Move-Item "agent-inbox/$commandId.tmp" "agent-inbox/$commandId.json"
while (!(Test-Path "agent-results/$commandId.json")) { Start-Sleep -Milliseconds 250 }
Get-Content "agent-results/$commandId.json" -Raw
```

If the app is not running, the command stays in the inbox until it starts. Never assume success without checking the result file. Do not edit the same page at the same time as the user is drawing.
