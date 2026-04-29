import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';

// Mock child components that might cause issues in shallow smoke tests
vi.mock('../pages/Index', () => ({
    default: () => <div data-testid="mock-home-page">Home Page</div>
}));

vi.mock('../pages/WatchPreview', () => ({
    default: () => <div data-testid="mock-watch-page">Watch Page</div>
}));

describe('App Component', () => {
    it('renders without crashing', () => {
        render(<App />);
        // Check if the router rendered the home page (default route)
        expect(screen.getByTestId('mock-home-page')).toBeInTheDocument();
    });
});
