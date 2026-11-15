// Jest stand-in: the real module is native-only ESM and cannot load in node.
export const AFTER_FIRST_UNLOCK = 0;
export const getItemAsync = jest.fn(async () => null);
export const setItemAsync = jest.fn(async () => {});
export const deleteItemAsync = jest.fn(async () => {});
