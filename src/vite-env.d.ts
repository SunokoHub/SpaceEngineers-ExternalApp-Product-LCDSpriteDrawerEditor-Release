/// <reference types="vite/client" />
interface Window {
  desktop?: {
    saveDocument(name: string, text: string): Promise<boolean>;
    closeWindow?(): void;
    setTheme?(theme: "dark" | "light"): void;
    onCloseRequested?(callback: () => void): () => void;
  };
}
