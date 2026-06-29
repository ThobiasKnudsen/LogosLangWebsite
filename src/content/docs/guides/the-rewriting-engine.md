---
title: The rewriting engine
description: One operation for compiler optimization, computer algebra, and user-defined transforms — built on equality saturation.
---

:::caution[Planned]
This describes the target design. The rewriting engine is not in the current
pre-release seed.
:::

Logos collapses three things usually built separately — compiler optimization
passes, a computer-algebra system, and user-defined code transformations — into
**one** operation, built on **equality saturation** (e-graphs, egg-style). Rule
sets and cost functions are ordinary, first-class Logos values.

That's why the same engine that lets the compiler rewrite `x + 0 → x` also lets
a mathematician rewrite `sin²θ + cos²θ → 1`. A compiler optimization pass isn't
special compiler code — it's a library.

```text
eval(optimize_for(target, kernel))   # target-specific rewriting, at compile time
```

Differentiating an expression, simplifying the derivative, and emitting native
code becomes one `eval`-bracketed pass with no runtime symbolic machinery.
