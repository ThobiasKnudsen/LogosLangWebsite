# types are values, so a function can return one,
# though nothing checks what is then done with it
def pick(i: int) -> type:
    return int if i == 0 else float

a = pick(1)(9.9)       # an ordinary float
print(pick(0) is int)  # True
