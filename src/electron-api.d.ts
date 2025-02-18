declare global {
    interface Window {
        electronAPI: {
            minimizeWindow: () => void;
            maximizeWindow: () => void;
            closeWindow: () => void;
        }
    }
} 