# lacking: source comes back as text and bytecode, not nodes; an expression runs before it can be read
# a function is an object: its signature, its source
# and its bytecode can all be read back
import inspect, dis

def power(b: int, n: int) -> int:
    return b ** n

print(inspect.signature(power))  # the signature
print(inspect.getsource(power))  # the source text
dis.dis(power)                   # the bytecode
