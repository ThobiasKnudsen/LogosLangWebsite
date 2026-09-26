-- lacking: read only from a metaprogram, not by the running program
-- a definition is a term the environment holds, and a
-- metaprogram reads its type and its body back
import Lean
open Lean Meta

def power (b : Int) : Nat → Int
  | 0 => 1
  | n + 1 => b * power b n

#print power   -- the definition: its type and body
#eval show MetaM Expr from do
  return (← getConstInfo ``power).type
