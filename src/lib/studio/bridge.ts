export const bridge: {
  openFile: (accept?: string) => void;
  stageSize: () => { w: number; h: number } | null;
} = {
  openFile: () => {},
  stageSize: () => null,
};
