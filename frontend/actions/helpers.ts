export function createMatrix(
  rows: number,
  cols: number,
  initial: number = 0
): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(initial));
}

export function addMatrices(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const cols = a[0].length;
  const result = createMatrix(rows, cols, 0);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i][j] = a[i][j] + b[i][j];
    }
  }
  return result;
}
