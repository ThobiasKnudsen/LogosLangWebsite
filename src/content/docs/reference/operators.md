---
title: Declaration & assignment
description: "The three-operator grammar (: declares, := declares-with-value, = reassigns) and the mut type modifier."
---

Logos construction is immutable-by-default and built from three operators that
compose cleanly.

| Operator | Meaning | Example |
| --- | --- | --- |
| `:` | **Declare** — set the type slot | `a : i32` |
| `:=` | **Declare with a value** — infer the type | `a := 32` |
| `=` | **Reassign** an already-declared name | `a = a + 1` |

They compose as `key : type = value`.

## `mut` is a type modifier

`mut` is not a keyword on a variable — it's a modifier on a **type** (`mut T` is
"the type of a mutable T"), applied recursively up the classifier tower. That
gives four distinct constructions:

```text
i32 32              # frozen type, frozen value      — a plain constant
mut i32 32          # frozen type, mutable value     — an ordinary variable
mut type i32 32     # mutable type, frozen value     — reinterpret-only
mut type mut i32 32 # both                           — full structural mutability
```

Every slot follows `undefined → defined → frozen`; the one-way flip to frozen is
`immut x`.
