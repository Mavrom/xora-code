export const basename = (path: string) => path.split(/[\\/]/).pop() ?? path;

export const extname = (path: string) => {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};
