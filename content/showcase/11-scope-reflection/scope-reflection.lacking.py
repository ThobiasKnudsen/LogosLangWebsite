# the call stack is reachable as frames at run time;
# the lexical scopes themselves are not values
import inspect

x = 1
def g():
    y = 2
    f = inspect.currentframe()
    print("y" in f.f_locals)         # True: here
    print("x" in f.f_back.f_locals)  # True: one up
g()
