;; a decimal literal is inexact unless marked #e,
;; which makes it an exact rational
#lang racket
(displayln (= (+ 0.1 0.2) 0.3))        ; #f
(displayln (= (+ #e0.1 #e0.2) #e0.3))  ; #t
