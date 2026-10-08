/** A tab in the main area of the webview. */
export interface View {
  id: string;
  label: string;
  element: HTMLElement;
  /** Called whenever the tab becomes visible. */
  onShow?(): void;
}
