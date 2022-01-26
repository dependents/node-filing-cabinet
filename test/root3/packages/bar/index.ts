import { doubleNumbers } from "@monorepo/foo";

export const run = () => {
  const value = doubleNumbers([1, 2, 3]);
  return value;
};

console.log(run());
