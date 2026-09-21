// the answer, computed the long way
const double = (x: number): number => x + x;

let sum = 0;
for (let i = 0; i < 7; i++) sum += i;
console.log(double(sum)); // 42
