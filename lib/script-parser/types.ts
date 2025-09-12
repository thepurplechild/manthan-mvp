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

// Alternate standardized shape with root-level aggregates
export type StandardizedScript = {
  title?: string;
  authors?: string[];
  scenes: Scene[];
  characters: { name: string; firstAppearance?: string }[];
  dialogue: { character: string; lines: string[]; sceneId: string }[];
  actions: { text: string; sceneId: string }[];
  transitions: { text: string; sceneId: string }[];
  warnings?: string[];
};
