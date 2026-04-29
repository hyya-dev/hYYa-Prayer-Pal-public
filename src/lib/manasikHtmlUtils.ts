const allowedHtmlTags = new Set([
  "b",
  "blockquote",
  "br",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "ul",
]);

type ManasikPlatform = "android" | "other";

function isAllowedManasikClass(value: string): boolean {
  return value === "pp-ios-only" || value === "pp-android-only";
}

function shouldKeepNodeForPlatform(node: Element, platform: ManasikPlatform): boolean {
  const className = node.getAttribute("class");
  if (!className) return true;

  // Only treat these two classes as meaningful; any other class gets stripped.
  if (!isAllowedManasikClass(className)) return true;

  if (className === "pp-android-only") return platform === "android";
  // Keep current behavior: treat non-android as "iOS/web" bucket.
  return platform !== "android";
}

export function sanitizeManasikHtml(input: string, platform: ManasikPlatform): string {
  if (!input) return "";
  if (typeof DOMParser === "undefined") {
    // Non-browser fallback: remove platform-specific items conservatively and strip all attributes.
    return input
      .replaceAll(/<li\s+class=["']pp-android-only["'][^>]*>[\s\S]*?<\/li>/gi, platform === "android" ? "$&" : "")
      .replaceAll(/<li\s+class=["']pp-ios-only["'][^>]*>[\s\S]*?<\/li>/gi, platform === "android" ? "" : "$&")
      .replaceAll(/<\/?([a-z0-9]+)(?:\s[^>]*?)?\s*\/?>/gi, (full, rawTag: string) => {
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
      .replaceAll(/\s{2,}/g, " ")
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
    if (!allowedHtmlTags.has(tag)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    // Strip all attributes except class on <li>, and even then only allow the two known values.
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name !== "class" || tag !== "li") {
        node.removeAttribute(attribute.name);
        continue;
      }

      if (!isAllowedManasikClass(attribute.value)) {
        node.removeAttribute(attribute.name);
      }
    }

    if (tag === "li" && !shouldKeepNodeForPlatform(node, platform)) {
      node.remove();
    }
  };

  for (const child of Array.from(root.childNodes)) {
    sanitizeNode(child);
  }

  return root.innerHTML.replaceAll(/\s{2,}/g, " ").trim();
}

