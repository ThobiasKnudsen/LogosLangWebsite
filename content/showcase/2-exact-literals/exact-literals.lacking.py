# a literal is a float; exactness is a library type
from fractions import Fraction as F

print(0.1 + 0.2 == 0.3)                 # False
print(F("0.1") + F("0.2") == F("0.3"))  # True
