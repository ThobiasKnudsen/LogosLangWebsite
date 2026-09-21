# the answer, computed the long way
def double(x: int) -> int:
    return x + x

total = 0
for i in range(7):
    total += i
print(double(total))  # 42
