# a class is both: instance attributes and class
# attributes, the latter read through either
class Point:
    dims = 2
    def __init__(self, x, y):
        self.x, self.y = x, y

p = Point(1, 2)
print(p.x, Point.dims, p.dims)  # 1 2 2
