import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App.jsx';

// The HTML for <App /> is pre-rendered at build time; hydrate attaches interactivity.
hydrateRoot(document.getElementById('root'), <App />);
