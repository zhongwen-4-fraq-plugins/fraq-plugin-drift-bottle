# Safe forwarded-message Markdown rendering

SUMMARY: Render forwarded-message bodies with a proven Markdown parser, while escaping generated metadata, disabling raw HTML and preventing Markdown image requests.
READ WHEN: before changing WebUI rendering or serialization for forwarded, quoted, or other nested message content

---

The persisted forwarded-message structure is the source of truth. The list formatter may generate Markdown headings for the forward title and sender names, but those structural fields must be Markdown-escaped. Message text and native Markdown segments may retain Markdown syntax intentionally.

The React renderer must keep raw HTML disabled. Links should accept only explicit `http` and `https` URLs and open with `noopener`; Markdown images must render as a text placeholder instead of an `<img>` so untrusted content cannot trigger external requests. Structured QQ images continue to use the authenticated media-preview flow rather than Markdown URLs.

Nested forwards need a fixed recursion limit and a readable text fallback after the limit. When forwarded content includes tables or code, constrain horizontal scrolling to the table or code block itself. The surrounding prose must remain width-constrained and wrap at narrow mobile widths.

When the list previews only the first few top-level messages, slice the persisted structured message array before Markdown serialization. Do not split the rendered Markdown on horizontal-rule text because nested forwards and user-authored Markdown can contain the same delimiter. Return the preview Markdown, full Markdown and top-level message count together; desktop and mobile views should share the same expansion key for each record and segment.

If a stored forward has no `messages` detail, preserve the compact `[合并转发：标题]` fallback instead of rendering an empty Markdown region.
