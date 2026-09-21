-- the answer, computed the long way
def double (x : Int) : Int := x + x

def main : IO Unit := do
  let mut sum : Int := 0
  for i in [0:7] do
    sum := sum + i
  IO.println (double sum) -- 42
