-- a theorem is a type and its proof a term the kernel
-- checks; the rewrites are the same steps
import Mathlib

theorem half (a : ℚ) (h : a ≠ 0) :
    (a + a) / a = 2 := by
  rw [← two_mul, mul_div_assoc, div_self h, mul_one]

#print axioms half -- the world it rests on
