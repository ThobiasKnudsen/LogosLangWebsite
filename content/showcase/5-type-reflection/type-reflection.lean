-- types are terms; a metaprogram reads a value's type
import Lean
open Lean Meta

def x : Int := 5

#eval show MetaM Bool from do
  let t ← inferType (mkConst ``x)
  return t == mkConst ``Int -- true
