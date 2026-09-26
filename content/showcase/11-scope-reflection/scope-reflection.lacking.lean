-- lacking: names in scope, only in a metaprogram; the scopes above are not values
-- inside a metaprogram, the local context is a value:
-- the names in scope, in order; nothing above them
import Lean
open Lean Elab Term

elab "names_here" : term => do
  let ns := (← getLCtx).decls.toList.filterMap
    (fun d => d.map (·.userName))
  logInfo m!"{ns}"
  return mkNatLit 0

def f (x y : Nat) : Nat := names_here -- [x, y]
