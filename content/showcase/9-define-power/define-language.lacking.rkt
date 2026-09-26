;; lacking: no precedence, one operator per parenthesis; the math is the built-in expt
;; a module can redefine application itself, so
;; (x ^ 3) reads the operator between its operands
#lang racket
(module infix racket
  (require (for-syntax syntax/parse))
  (provide (rename-out [app #%app])
           (except-out (all-from-out racket) #%app))
  (define-syntax (app stx)
    (syntax-parse stx
      [(_ lhs (~literal ^) rhs) #'(expt lhs rhs)]
      [(_ f x ...) #'(#%app f x ...)])))

(module main (submod ".." infix)
  (define (f x) (+ (x ^ 3) 1))
  (displayln (f 2))) ; 9, one operator per parenthesis
