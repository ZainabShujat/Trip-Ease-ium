import { z } from 'zod';

/**
 * Outbound links.
 *
 * Architecture rule (Phase 0 §G): the application must never invent a URL, and
 * an LLM must never produce one. Every link in the product is built by
 * src/providers/links.ts from a whitelisted template, and carries the kind of
 * link it actually is so the UI can label it truthfully.
 *
 *   deeplink — a documented, parameterised URL that lands on the exact thing
 *              (Google Maps place and directions URLs). Label: "Open in Maps".
 *   search   — a documented search URL pre-filled with our parameters. It
 *              lands on results, not a specific booking. Label: "Search on X".
 *   landing  — the provider's home page. Used when no parameterised form is
 *              known to us. Label: "Go to X".
 *
 * There is deliberately no fourth kind. If none of these can be produced, the
 * builder returns null and the UI shows plain guidance instead of a button
 * that would lie about where it goes.
 */
export const LinkKindSchema = z.enum(['deeplink', 'search', 'landing']);
export type LinkKind = z.infer<typeof LinkKindSchema>;

export const ExternalLinkSchema = z.object({
  url: z.url(),
  /** Button text. Written by the builder, matched to `kind`. */
  label: z.string().min(1),
  /** Human name of the destination, e.g. "Google Maps", "redBus". */
  provider: z.string().min(1),
  kind: LinkKindSchema,
});
export type ExternalLink = z.infer<typeof ExternalLinkSchema>;
