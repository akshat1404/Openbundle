export function useShared() {
  const shared = 5;
  return shared * 2;
}

export const meta = { shared: 'not the function', label: 'shared' };
