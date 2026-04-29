const allowedHtmlTags = new Set([
  "b",
  "blockquote",
  "br",
  "em",
  "h3",
  "h4",
  "i",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "ul",
]);

export function sanitizeTafsirHtml(input: string): string {
  if (!input) return "";
  if (typeof DOMParser === "undefined") {
    const stripped = input
      .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
      .replace(/<a\s+class=["']sup["'][^>]*>[\s\S]*?<\/a>/gi, "");

    // Fallback sanitizer for non-browser environments: keep only allowed tags
    // and strip all attributes so behavior mirrors the DOMParser branch.
    return stripped
      .replace(/<\/?([a-z0-9]+)(?:\s[^>]*?)?\s*\/?>/gi, (full, rawTag: string) => {
        const tag = rawTag.toLowerCase();
        if (!allowedHtmlTags.has(tag)) {
          return "";
        }

        const isClosing = full.startsWith("</");
        if (isClosing) {
          return `</${tag}>`;
        }

        return `<${tag}>`;
      })
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${input}</div>`, "text/html");
  const root = doc.body.firstElementChild;

  if (!root) return "";

  const sanitizeNode = (node: Node) => {
    if (!(node instanceof Element)) return;

    for (const child of Array.from(node.childNodes)) {
      sanitizeNode(child);
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "sup" || (tag === "a" && node.classList.contains("sup"))) {
      node.remove();
      return;
    }

    if (!allowedHtmlTags.has(tag)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    for (const attribute of Array.from(node.attributes)) {
      node.removeAttribute(attribute.name);
    }
  };

  for (const child of Array.from(root.childNodes)) {
    sanitizeNode(child);
  }

  return root.innerHTML.replace(/\s{2,}/g, " ").trim();
}

export function stripDuplicateBasmalaPrefix(input: string, ayaNo: number): string {
  if (!input) return input;
  if (ayaNo !== 1) return input;

  // Arabic diacritics (harakat) range – make them optional so the regex works
  // whether the text uses full tashkeel (بِسْمِ الل) or plain undiacritical text
  // (بسم الله), which is what most tafsir JSON files contain.

  // Pattern 1: bracketed Basmalah  →  ( بسم ... الرحيم )
  const bracketedBasmalah =
    /^\s*(?:<(?:p|div|span)[^>]*>\s*)*\(\s*\u0628[\u064B-\u065F]*\u0633[\u064B-\u065F]*\u0645[\s\S]{0,80}?\u0627\u0644\u0631\u062D\u064A\u0645[\u064B-\u065F]*\s*\)\s*(?:<\/(?:p|div|span)>\s*)*/u;

  // Pattern 2: English bracketed Basmalah
  const bracketedBasmalahEn =
    /^\s*(?:<(?:p|div|span)[^>]*>\s*)*\(\s*in\s+the\s+name\s+of\s+allah[^)]*\)\s*(?:<\/(?:p|div|span)>\s*)*/i;

  // Pattern 3: non-bracketed Arabic Basmalah at very start
  const unbracketedBasmalahAr =
    /^\s*(?:<(?:p|div|span)[^>]*>\s*)*\u0628[\u064B-\u065F]*\u0633[\u064B-\u065F]*\u0645[\s\S]{0,120}?\u0627\u0644\u0631\u062D\u064A\u0645[\u064B-\u065F]*\s*(?:<\/(?:p|div|span)>\s*)*/u;

  // Pattern 4: non-bracketed English Basmalah at very start
  const unbracketedBasmalahEn =
    /^\s*(?:<(?:p|div|span)[^>]*>\s*)*in\s+the\s+name\s+of\s+allah\s*[,;:-]?\s*(?:the\s+most\s+gracious\s*,\s*the\s+most\s+merciful|the\s+entirely\s+merciful\s*,\s*the\s+especially\s+merciful|the\s+compassionate\s*,\s*the\s+merciful|the\s+most\s+merciful|most\s+merciful|the\s+most\s+gracious|most\s+gracious)?\s*(?:<\/(?:p|div|span)>\s*)*/i;

  const patterns = [bracketedBasmalah, unbracketedBasmalahAr, bracketedBasmalahEn, unbracketedBasmalahEn];

  let result = input;
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      const next = result.replace(pattern, "");
      if (next !== result) {
        result = next;
        changed = true;
      }
    }
  }

  result = result.trim();

  return result;
}