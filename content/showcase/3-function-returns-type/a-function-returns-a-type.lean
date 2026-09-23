-- a definition can return a type; types are terms
def pick (i : Nat) : Type :=
  if i = 0 then Int else Float

def a : pick 1 := (9.9 : Float) -- a is a Float
example : pick 0 = Int := rfl
