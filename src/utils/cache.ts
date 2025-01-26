import NodeCache from "node-cache";

export const MyCache = new NodeCache({
  stdTTL: 60 * 60 * 6,
  checkperiod: 60 * 5,
});
