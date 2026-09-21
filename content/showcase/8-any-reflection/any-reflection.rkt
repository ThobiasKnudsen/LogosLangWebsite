;; a procedure's name and arity can be read back;
;; its body cannot, once compiled
#lang racket

(define (power b n) (expt b n))

(displayln (object-name power))     ; power
(displayln (procedure-arity power)) ; 2
