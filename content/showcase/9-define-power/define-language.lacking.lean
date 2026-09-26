-- lacking: Int base and Nat exponent only: no floats, no negative or fractional exponent
-- a new operator is a notation, written in Lean and
-- used in the same file
def power (b : Int) : Nat → Int
  | 0 => 1
  | n + 1 => b * power b n

infixr:75 " ** " => power

def f (x : Int) : Int := x ** 3 + 1
#eval f 2 -- 9
