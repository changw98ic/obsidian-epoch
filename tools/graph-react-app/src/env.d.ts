/// <reference types="vite/client" />

declare module "three-spritetext" {
  import { Sprite } from "three";

  export default class SpriteText extends Sprite {
    constructor(text?: string, textHeight?: number, color?: string);
    text: string;
    textHeight: number;
    color: string;
    fontFace: string;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    padding: number;
  }
}

declare module "3d-force-graph";

declare module "three/examples/jsm/controls/OrbitControls" {
  export { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
}

interface Window {
  __WORLD_MAP_DATA__?: import("./types").WorldMapData;
  __WORLD_MAP_QA__?: unknown;
  __OBSIDIAN_GRAPH_QA__?: unknown;
}
