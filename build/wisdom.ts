// The reflections on the Logos across the ages, shown as marginalia: stacked down
// the page's two outer margins on every page, faint until the pointer is on one,
// and scrolling with the page like glosses in a manuscript (see .margin in
// theme.css and initMarginalia in client/main.ts). They ran as a slow frieze under the homepage hero
// from 26 August to 21 September 2026 (with a few days pinned across the top of the
// screen, and one as a vertical rail); Thobias moved them into the margins on 21
// September 2026.
import { escapeHtml } from "./templates.ts";

// Rendered in English (italic, EB Garamond) so visitors actually
// understand them; the sources are Greek and Latin, and the renderings here are our
// own, kept plain on purpose (Thobias, 2026-08-26) rather than literal. Greek
// antiquity, the Stoics, and the Latin Fathers (Vulgate John, Augustine, Anselm,
// Aquinas) meet on the one Word, Λόγος / Verbum, through which all things are made
// and known. Attributions name only the person (and "John 1:1" / "Hebrews 4:12"
// alone, so the set reads as antiquity rather than as a denominational
// statement). Sources, in order:
// John 1:1 (Vulgate); Heraclitus, Fragment 1 (DK B1); Gorgias, Encomium of Helen 8;
// Augustine, De Trinitate 15.11.20; Anselm, Monologion 30; Heraclitus, Fragment 50
// (DK B50); Aristotle, Politics 1253a; Epictetus, Discourses 1.1; Cicero, De
// Officiis 1.50; Plato, Sophist 263e; Heraclitus, Fragment 45 (DK B45); Seneca,
// Epistles 115.2; Clement of Alexandria, Protrepticus 1.5; Isocrates, Nicocles 7;
// Thomas Aquinas, Summa Theologiae I.34.3; Augustine, De Trinitate 6.10.11; Philo
// of Alexandria; Heraclitus, Fragment 2 (DK B2); Cleanthes, Hymn to Zeus 12-13;
// Hebrews 4:12; Heraclitus, Fragment 115 (DK B115); "verba volant, scripta manent"
// is a traditional Latin proverb with no single ancient source; the "Stoic
// tradition" line's exact source is uncertain, swap in a precise citation when you
// have one.
// Each quote carries explicit "\n" line breaks, the stanza it was written as; in a
// margin too narrow for those lines the CSS wraps the text as prose instead, and
// the breaks collapse to spaces. Wherever the source word is λόγος (or
// Verbum standing for it) it is left untranslated as "Logos", since no English word
// covers word, speech and reason at once; Cicero's "ratio et oratio", Seneca's
// "oratio" and Epictetus's "logikē dynamis" (the power of Logos), the Latin and
// Greek for the same idea, are rendered "Logos" as well, so that every line says
// something about the Logos itself. Augustine's "verbum quod foris sonat" is Logos
// too: he uses one word for the outer and the inner, and says the name belongs more
// properly to the inner. Only the ordinary plural "words" stays English, in Anselm's
// contrast and the proverb. Heraclitus appears five times because he is where the
// word begins; his fragments are spaced out along the sequence. The Aristotle line
// keeps its internal "…", which marks a real elision between two clauses of the
// Politics.
const WISDOM: { text: string; author: string }[] = [
  {
    text: "In the beginning was the Logos,\nand the Logos was with God,\nand the Logos was God.",
    author: "John 1:1",
  },
  {
    text: "Though this Logos holds forever,\npeople fail to understand it,\nboth before they hear it\nand once they have heard it.",
    author: "Heraclitus",
  },
  {
    text: "Logos is a mighty lord:\nwith the smallest and least visible body\nit achieves the most divine works.",
    author: "Gorgias",
  },
  {
    text: "The Logos spoken aloud\nis only a sign of the Logos\nthat shines within.",
    author: "Augustine",
  },
  {
    text: "It does not consist of many words,\nbut is one Logos\nthrough which all things were made.",
    author: "Anselm",
  },
  {
    text: "Listen not to me but to the Logos,\nand you will find it wise to agree:\nall things are one.",
    author: "Heraclitus",
  },
  {
    text: "Alone among the animals, humans have Logos…\nand Logos exists to make clear\nthe useful and the harmful,\nand so the just and the unjust.",
    author: "Aristotle",
  },
  {
    text: "Every other ability judges only its own subject.\nThe Logos alone judges itself,\nand all the others.",
    author: "Epictetus",
  },
  {
    text: "The bond of human fellowship\nis Logos.",
    author: "Cicero",
  },
  {
    text: "Thought is Logos:\nthe soul's silent dialogue\nwith itself.",
    author: "Plato",
  },
  {
    text: "You could not find the limits of the soul,\nthough you travelled every road:\nso deep is its Logos.",
    author: "Heraclitus",
  },
  {
    text: "Logos is the face of the soul.",
    author: "Seneca",
  },
  {
    text: "The Logos tuned the whole world into harmony\nand turned the clashing elements\ninto one symphony.",
    author: "Clement of Alexandria",
  },
  {
    text: "Logos that is true, lawful and just\nis the image\nof a good and faithful soul.",
    author: "Isocrates",
  },
  {
    text: "God knows himself and all things in one act,\nso his single Logos expresses\nnot the Father alone, but every creature.",
    author: "Thomas Aquinas",
  },
  {
    text: "The Logos is the art of God,\nfull of every living pattern,\nand none of them ever changes.",
    author: "Augustine",
  },
  {
    text: "The Logos of God is\nthe bond of all things,\nholding the parts together and binding them fast.",
    author: "Philo of Alexandria",
  },
  {
    text: "The Logos is shared by all,\nyet most people live\nas if each had a truth of their own.",
    author: "Heraclitus",
  },
  {
    text: "The common Logos\nmoves through all things.",
    author: "Cleanthes",
  },
  {
    text: "For the Logos of God is living and active,\nsharper than any two-edged sword.",
    author: "Hebrews 4:12",
  },
  {
    text: "The soul has a Logos\nthat grows itself.",
    author: "Heraclitus",
  },
  {
    text: "Spoken words fly away,\nwritten words remain.",
    author: "Latin proverb",
  },
  {
    text: "God is nothing other\nthan mind and Logos.",
    author: "Stoic tradition",
  },
];

/** The two margins of a page, each a column of the quotes stacked end to end from
 *  the top of the page down (theme.css), so that wherever the pointer is in a
 *  margin it is over one of them: the one under it shows, the next shows the
 *  moment the pointer crosses into it, and the margin is never quiet (Thobias, 21
 *  September 2026). Each side carries all the quotes, the left leading with the
 *  even-numbered ones and the right with the odd, so the two columns differ where
 *  a reader starts; a page taller than the stack has it repeated by the client
 *  (initMarginalia). Decorative and hover-only, so hidden from assistive tech. */
export function wisdomMarginsHtml(): string {
  const figure = (q: { text: string; author: string }): string =>
    `<figure class="margin__quote"><blockquote class="wisdom__text">${escapeHtml(
      q.text,
    )}</blockquote><figcaption class="wisdom__author">- ${escapeHtml(
      q.author,
    )}</figcaption></figure>`;
  const half = (parity: number) => WISDOM.filter((_, i) => i % 2 === parity);
  const side = (name: string, first: number): string =>
    `<aside class="margin margin--${name}" aria-hidden="true">${[
      ...half(first),
      ...half(1 - first),
    ]
      .map(figure)
      .join("")}</aside>`;
  return `${side("left", 0)}\n${side("right", 1)}`;
}
