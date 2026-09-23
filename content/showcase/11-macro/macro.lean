-- a notation is a syntax rewrite, written in Lean and
-- used in the same file, postfix included
notation:70 x:70 " twice" => x * 2

#eval 3 + 4 twice -- 11
