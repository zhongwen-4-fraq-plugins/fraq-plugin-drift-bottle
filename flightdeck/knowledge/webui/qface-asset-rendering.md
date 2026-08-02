# QFace asset rendering checklist

SUMMARY: Always resolve QQ face IDs through QFace index assets, cache the shared index request, validate every asset URL, and preserve an ID-bearing text fallback.
READ WHEN: before any WebUI QQ face preview or external emoji asset integration change

---

Keep the persisted message segment as the source of truth and pass its string `face_id` plus a readable fallback such as `[表情：14]` to the frontend. Do not persist or trust a third-party asset URL as message data.

For `https://koishi.js.org/QFace/assets/qq_emoji/_index.json`:

- fetch the index only after a face enters the rendered list and share one cached promise across every row;
- match `emojiId` as a string;
- prefer a type `0` PNG whose filename is `<face_id>.png`, then another type `0` PNG, then a type `2` APNG;
- resolve the selected `assets[].path` against `https://koishi.js.org/QFace/`;
- accept only the QFace origin and `/QFace/assets/qq_emoji/` path prefix;
- fall back to the original text when the index is unavailable, the entry has no visual asset, the path is invalid, or the image fails to load.

Use the static PNG in the dense management UI to avoid decorative motion. Render it as a fixed 24px inline image with descriptive alt text, lazy decoding, and `referrerPolicy="no-referrer"` so it cannot shift list geometry or leak the WebUI route through the referrer.
