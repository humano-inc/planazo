/**
 * Reading a code back out of whatever someone pasted.
 *
 * The other direction — building the link we hand out — lives in
 * `lib/shareLinks`, next to the plan link that shares its rules.
 */

/** Eight characters from an alphabet with no 0, 1, I or O to confuse. */
const CODE_ANYWHERE = /[A-HJ-NP-Z2-9]{8}/;
const WHOLE_CODE = /^[A-HJ-NP-Z2-9]{8}$/;

/**
 * The tail of a link we handed out, in either scheme it travels as.
 *
 * `PLANAZO://JOIN/…` and `…PLANAZO.ME/JOIN/…` in one pattern, because the text
 * is already uppercased by the time it is matched.
 */
const LINKED_CODE = /PLANAZO(?::\/\/|\.ME\/)JOIN\/([A-Z0-9]*)/;

/**
 * Invite codes travel as links; accept a raw code or anything containing one.
 *
 * A link wins over a bare scan, and that ordering is the whole reason this is
 * more than one line. People paste a whole message, and a message says things
 * before it says the link: "Handball squad https://planazo.me/join/ABCD2345"
 * scanned naively resolves to HANDBALL, which is eight legal characters and
 * the wrong group.
 *
 * A link that carries a bad code answers `null` rather than falling through to
 * the scan. Its segment is the code the sender meant, so a mistyped one must
 * not quietly resolve to some other word in the same message.
 */
export function inviteCodeFrom(text: string): string | null {
  const upper = text.toUpperCase();

  const linked = upper.match(LINKED_CODE)?.[1];
  if (linked !== undefined) return WHOLE_CODE.test(linked) ? linked : null;

  return upper.match(CODE_ANYWHERE)?.[0] ?? null;
}
