import React from 'react';
import {render, screen} from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/Assiged on 2025-10-28/i);
  expect(linkElement).toBeInTheDocument();
});
