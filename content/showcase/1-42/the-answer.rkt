;; the answer, computed the long way
#lang racket

(define (double x) (+ x x))

(define sum
  (for/sum ([i (in-range 7)]) i))
(displayln (double sum)) ; 42
