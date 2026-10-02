# Mockups drawing context

This directory is the live project folder of the Mockups desktop app. The drawing canvas is in the other pane of the same app.

When the user asks about the drawing, layout, active page, or changes made in Mockups:
1. Re-read `project.json` to find `activeId`, the page titles and the page tree. Do not rely on previously read content; it changes while the app runs.
2. Use your image-reading tool (Read) to open `canvas.png` as an image. This is the most recently saved rendering of the ACTIVE page. If you need precise object positions, text or groups, also read `canvas.json` (an array of editable strokes).
3. For another page, use its ID from `project.json` and open `pages/<id>.png` and, if needed, `pages/<id>.json`.
4. Describe only what you can actually infer from these files. Do not claim to see the live screen, pointer position, unsaved pen strokes, open menus, or the user's actions in real time.

When the user asks you to add, change or delete objects on the canvas, read `AGENT-API.md` and send commands through `agent-inbox/`; check `agent-results/` before claiming success. This changes the live canvas with undo and autosave. Do not write app-managed drawing files directly.

The app saves about 450 ms after a completed drawing action. If the user has just drawn something, wait briefly and read the files again. These are app-managed output files: DO NOT edit `canvas.png`, `canvas.json`, `project.json`, or `pages/*` directly while Mockups is open; the app may overwrite changes. Ask before making changes to other files.

## Suggestions after changes

After completing a requested canvas/layout change:
- Briefly summarize what changed and whether the command result confirmed success. If you inspected the saved image afterward, say so; otherwise do not imply visual verification.
- Add a short **Järgmised sammud** section with 1–3 concrete, useful suggestions based on the user's goal and the actual page, its notes and the changes you made. Prioritize the most valuable next step (e.g. a missing interaction state, clearer visual hierarchy, a mobile layout or a relevant usability check).
- Avoid generic filler, repeating completed work, or inventing page details you have not inspected. If no useful next step follows, omit suggestions rather than forcing them.
- Suggestions are optional proposals, not instructions to yourself: do not execute them without the user's approval.
- Keep the response concise. If the user asks for only the requested change or no suggestions, respect that.

Reply in Estonian unless the user requests another language.
