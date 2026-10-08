/**
 * Thin wrapper around the VS Code webview API.
 */
import { HostMessage, WebviewMessage } from '../core/messages.js';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

export function post(message: WebviewMessage): void {
  vscode.postMessage(message);
}

export function onHostMessage(handler: (message: HostMessage) => void): void {
  window.addEventListener('message', (event: MessageEvent<HostMessage>) => handler(event.data));
}

export function getViewState<T>(): T | undefined {
  return vscode.getState() as T | undefined;
}

export function setViewState(state: unknown): void {
  vscode.setState(state);
}
