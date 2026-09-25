declare module 'mammoth' {
  export interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer } | { buffer: Buffer }): Promise<MammothResult>;
  export function extractRawText(input: { arrayBuffer: ArrayBuffer } | { buffer: Buffer }): Promise<MammothResult>;
}

declare module 'docx-preview' {
  export interface RenderOptions {
    className?: string;
    inWrapper?: boolean;
    ignoreWidth?: boolean;
    ignoreHeight?: boolean;
    ignoreFonts?: boolean;
    breakPages?: boolean;
    debug?: boolean;
    experimental?: boolean;
    trimXml?: boolean;
  }
  export function renderAsync(
    data: Blob | ArrayBuffer | Uint8Array,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement,
    options?: Partial<RenderOptions>
  ): Promise<any>;
}
