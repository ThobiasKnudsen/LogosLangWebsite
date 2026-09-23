-- a structure holds the fields; a definition in its
-- namespace is read through the name, not a value
structure Point where
  x : Int
  y : Int

def Point.dims : Int := 2

def p : Point := ⟨1, 2⟩
#eval (p.x, Point.dims) -- (1, 2)
