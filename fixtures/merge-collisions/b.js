export function shared() {
  return 'b';
}

export function helperB() {
  return shared();
}
