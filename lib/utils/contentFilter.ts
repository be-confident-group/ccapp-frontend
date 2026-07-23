/**
 * Client-side pre-submission check that blocks obvious profanity/slurs
 * before a post or comment is sent (App Store Guideline 1.2's "method for
 * filtering objectionable material from being posted").
 *
 * This is a first line of defense, not a substitute for moderation — it
 * only catches English profanity from the bad-words wordlist.
 * TODO(backend): add server-side filtering too, and extend coverage to the
 * app's other supported languages (es, bn, pl, ur).
 */

import { Filter } from 'bad-words';

const filter = new Filter();

export function containsObjectionableContent(text: string): boolean {
  if (!text.trim()) return false;
  return filter.isProfane(text);
}
