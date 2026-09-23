-- a Float literal rounds; as a ℚ it is exact
import Mathlib

#eval (0.1 : Float) + 0.2 == 0.3  -- false
example : (0.1 : ℚ) + 0.2 = 0.3 := by norm_num
