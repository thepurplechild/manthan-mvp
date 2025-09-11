export type Dialogue = { character: string; lines: string[] };

export type Scene = {
  id: string;
  heading: string; // INT./EXT./INT./EXT.
  action: string[];
  dialogues: Dialogue[];
  transitions?: string[];
};

export type ScriptJSON = {
  title?: string;
  authors?: string[];
  scenes: Scene[];
  characters: { name: string; firstAppearance?: string }[];
  warnings?: string[];
};

