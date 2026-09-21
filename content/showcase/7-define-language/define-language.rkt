;; a new form is a macro: syntax written in Racket and
;; used in the same module
#lang racket

(define-syntax-rule (^ base n)
  (for/fold ([r 1]) ([_ (in-range n)])
    (* r base)))

(define (f x) (+ (^ x 3) 1))
(displayln (f 2)) ; 9
