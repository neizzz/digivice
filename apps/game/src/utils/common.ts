export function cloneDeep<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function nomalizeRadian(radian: number): number {
  // Normalize the radian to be within the range of -PI to PI
  while (radian < -Math.PI) {
    radian += 2 * Math.PI;
  }
  while (radian > Math.PI) {
    radian -= 2 * Math.PI;
  }
  return radian;
}
