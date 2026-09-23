# types are objects, and `type` is its own type
x = 5

same = type(x) is int     # True
cross = type(x) is float  # False
meta = type(int) is type  # True
print(same and meta and not cross)
