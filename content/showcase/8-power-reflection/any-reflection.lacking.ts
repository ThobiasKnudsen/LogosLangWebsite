// a function is an object: its name, arity and source
// text can be read back; its types are erased
function power(b: number, n: number): number {
  return b ** n;
}

console.log(power.name, power.length); // power 2
console.log(power.toString());  // the source text
