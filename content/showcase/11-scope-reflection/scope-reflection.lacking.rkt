;; a namespace lists what a spot can name; the scopes
;; a line stands in are not values, hygiene keeps them
#lang racket
(define x 1)
(define-namespace-anchor here)
(define ns (namespace-anchor->namespace here))
(displayln (namespace-variable-value 'x #t #f ns)) ; 1
