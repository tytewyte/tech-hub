// Define lazy loaded components and utilities
export const lazyLoad = (componentPath) => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = componentPath;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
};

// Lazy loading registry
const componentRegistry = {
  'HVACDiagnosticAgent': '/js/hvac-agent.js',
  'ManualViewer': '/js/modules/manuals.js',
  'TroubleshootingFlow': '/js/modules/troubleshooting.js',
  'KnowledgeBase': '/js/modules/knowledge-base.js',
  'UserProfile': '/js/modules/user-profile.js',
  'AppMain': '/js/app.js'  // Add main app for lazy loading if needed
};

// Component loader with caching
class ComponentLoader {
  constructor() {
    this.loadedComponents = new Map();
  }

  async load(componentName) {
    // Check if component is already loaded
    if (this.loadedComponents.has(componentName)) {
      return this.loadedComponents.get(componentName);
    }

    // Get component path
    const componentPath = componentRegistry[componentName];
    if (!componentPath) {
      throw new Error(`Component ${componentName} not found in registry`);
    }

    // Load component
    await lazyLoad(componentPath);
    
    // Cache component
    const component = window[componentName];
    this.loadedComponents.set(componentName, component);
    return component;
  }

  clearCache() {
    this.loadedComponents.clear();
  }
}

export const loader = new ComponentLoader();

// Initialize lazy loading system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Pre-register essential components
  const essentialComponents = ['AppMain', 'HVACDiagnosticAgent', 'ManualViewer'];
  essentialComponents.forEach(component => {
    loader.load(component).catch(error => {
      console.error(`Failed to pre-load component ${component}:`, error);
    });
  });
});