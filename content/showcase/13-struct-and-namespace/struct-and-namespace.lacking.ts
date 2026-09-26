// lacking: `Point.dims` cannot be read through an instance
// a class holds fields; a static member is read
// through the class, not through an instance
class Point {
  static dims = 2;
  constructor(public x: number, public y: number) {}
}

const p = new Point(1, 2);
console.log(p.x, Point.dims); // 1 2
