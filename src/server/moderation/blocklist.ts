// Terms that block an image or video prompt before it spends credits or
// reaches a provider. Matching ignores case, full-width letters, extra
// spaces and zero-width characters; Latin terms match whole words.
//
// This list covers only content that is illegal everywhere. Add the terms
// your own content policy forbids, in every language your users write in.
export const BLOCKED_TERMS: readonly string[] = [
  "child porn",
  "child pornography",
  "csam",
  "儿童色情",
  "幼女色情",
];
