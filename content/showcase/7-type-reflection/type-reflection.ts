// typeof names a handful of run-time kinds; the
// static types themselves are gone by run time
const x = 5;

const same = typeof x === "number"; // true
const cross = typeof x === "string"; // false
console.log(same && !cross);
