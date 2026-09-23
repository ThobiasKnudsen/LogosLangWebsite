;; a macro rewrites syntax, written in Racket and used
;; in the same file; prefix, as every form is a list
#lang racket
(define-syntax-rule (twice e) (* e 2))
(displayln (+ 3 (twice 4))) ; 11
