---
title: Introduction
description: What Logos is, why it exists, and the one idea everything else follows from — radical unification.
---

Logos is a self-hosting systems language built on a single commitment: **radical
unification**. The boundaries we take for granted — language versus compiler,
code versus specification, program versus proof, source versus tooling — are
accidents of how systems were historically built, not necessities. Collapse
them and what's left is simpler at its core, more expressive in what it can
state, and more honest about what it is.

Everything the system contains — your program, its types, its proofs, the
optimizer, the standard library, the parsing rules, and the compiler's own logic
— lives in one structure the language can read and rewrite: the **Logic Graph**.
There is no separation between "the language" and "what is written in it."

## What you get

- A **systems language**: static memory safety via a borrow checker, no garbage
  collector, explicit ownership, zero-cost abstraction.
- **Interpret by default, JIT on demand**: code runs interpreted; freeze a
  region and it compiles via Cranelift, staying fully reflectable.
- **One rewriting engine** for compiler optimization, computer algebra, and your
  own transforms — the same operation serves `x + 0 → x` and `sin²θ + cos²θ → 1`.
- **Layered verification**: opt into refinement types, contracts, and full
  dependent-type proofs only where you want them. You pay only for what you use.

## See it run

Logos is **pre-release and building in the open**. The first milestone is the
smallest possible end-to-end proof of life: a program that runs both interpreted
and JIT-compiled, with the interpreter result used as the correctness oracle for
the compiled one.

```text
# the canonical smoke test
a := mut i32 32
a = a + 1     # → 33, identical interpreted and Cranelift-compiled
```

From there: a `struct`, a recursive `fn`, and `if`/`while` — running identically
on both tiers. Follow [the build on GitHub](https://github.com/ThobiasKnudsen/LogosLang)
to watch the seed grow toward self-hosting.

:::note
This documentation grows alongside the language. Sections describing capabilities
that aren't in the current release are marked as planned.
:::
