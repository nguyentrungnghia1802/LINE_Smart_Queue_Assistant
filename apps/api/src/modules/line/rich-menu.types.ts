export interface RichMenuBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RichMenuUriAction {
  type: 'uri';
  label: string;
  uri: string;
}

export interface RichMenuArea {
  bounds: RichMenuBounds;
  action: RichMenuUriAction;
}

export interface RichMenuDefinition {
  size: {
    width: number;
    height: number;
  };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: RichMenuArea[];
}

export interface RichMenuSummary {
  richMenuId: string;
  name: string;
  chatBarText?: string;
}

export interface RichMenuImageConfig {
  buffer: Buffer;
  contentType: 'image/png' | 'image/jpeg';
  source: string;
}
