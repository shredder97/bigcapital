declare module '@testing-library/react' {
  export function render(ui: unknown): {
    container: HTMLElement;
    rerender: (ui: unknown) => void;
  };
  export function cleanup(): void;
  export const fireEvent: {
    click: (element: Element) => void;
  };
  export const screen: {
    getByRole: (role: string, options?: unknown) => HTMLElement;
    getAllByRole: (role: string, options?: unknown) => HTMLElement[];
    queryByRole: (role: string, options?: unknown) => HTMLElement | null;
    getByText: (text: string | RegExp) => HTMLElement;
    getAllByText: (text: string | RegExp) => HTMLElement[];
    queryByText: (text: string | RegExp) => HTMLElement | null;
  };
}
