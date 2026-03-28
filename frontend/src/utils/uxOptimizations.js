/**
 * UX Optimization Utilities
 * Provides various utilities to enhance user experience
 */

import { sanitizeSuggestions, sanitizeHtml, sanitizeJsonForDisplay } from './inputSanitization';

class UXOptimizer {
  constructor() {
    this.features = {
      smartForms: new SmartForms(),
      progressiveLoading: new ProgressiveLoading(),
      offlineSupport: new OfflineSupport(),
      accessibility: new Accessibility(),
      performance: new PerformanceOptimizer(),
      animations: new AnimationController(),
      shortcuts: new KeyboardShortcuts(),
      tooltips: new TooltipManager(),
      notifications: new NotificationManager(),
      search: new SmartSearch()
    };
  }

  /**
   * Initialize all UX features
   */
  async initialize() {
    try {
      await Promise.all([
        this.features.smartForms.initialize(),
        this.features.progressiveLoading.initialize(),
        this.features.offlineSupport.initialize(),
        this.features.accessibility.initialize(),
        this.features.performance.initialize(),
        this.features.animations.initialize(),
        this.features.shortcuts.initialize(),
        this.features.tooltips.initialize(),
        this.features.notifications.initialize(),
        this.features.search.initialize()
      ]);

      console.log('UX Optimizer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize UX Optimizer:', error);
      throw error;
    }
  }

  /**
   * Get feature status
   */
  getStatus() {
    return {
      smartForms: this.features.smartForms.getStatus(),
      progressiveLoading: this.features.progressiveLoading.getStatus(),
      offlineSupport: this.features.offlineSupport.getStatus(),
      accessibility: this.features.accessibility.getStatus(),
      performance: this.features.performance.getStatus(),
      animations: this.features.animations.getStatus(),
      shortcuts: this.features.shortcuts.getStatus(),
      tooltips: this.features.tooltips.getStatus(),
      notifications: this.features.notifications.getStatus(),
      search: this.features.search.getStatus()
    };
  }
}

/**
 * Smart Forms - Intelligent form handling with validation, auto-complete, and smart defaults
 */
class SmartForms {
  constructor() {
    this.forms = new Map();
    this.validators = new Map();
    this.autoCompleteData = new Map();
  }

  async initialize() {
    this.setupGlobalValidation();
    this.setupAutoComplete();
    this.setupSmartDefaults();
    console.log('Smart Forms initialized');
  }

  /**
   * Register a form with smart features
   */
  registerForm(formId, config) {
    const form = {
      id: formId,
      element: document.getElementById(formId) || document.querySelector(`[data-form="${formId}"]`),
      config,
      fields: new Map(),
      validation: config.validation || {},
      autoComplete: config.autoComplete || false,
      smartDefaults: config.smartDefaults || {}
    };

    if (!form.element) {
      throw new Error(`Form element not found: ${formId}`);
    }

    this.setupFormFields(form);
    this.setupFormValidation(form);
    this.setupAutoCompleteForForm(form);
    this.setupSmartDefaultsForForm(form);

    this.forms.set(formId, form);
    return form;
  }

  /**
   * Setup form fields
   */
  setupFormFields(form) {
    const fields = form.element.querySelectorAll('input, select, textarea');
    
    fields.forEach(field => {
      const fieldName = field.name || field.id;
      form.fields.set(fieldName, {
        element: field,
        type: field.type,
        required: field.required,
        validation: form.validation[fieldName] || {},
        autoComplete: form.autoComplete && form.autoComplete[fieldName],
        smartDefault: form.smartDefaults[fieldName]
      });

      // Add event listeners
      this.setupFieldEvents(form, fieldName, field);
    });
  }

  /**
   * Setup field events
   */
  setupFieldEvents(form, fieldName, field) {
    // Real-time validation
    field.addEventListener('blur', () => {
      this.validateField(form, fieldName);
    });

    field.addEventListener('input', () => {
      this.clearFieldError(form, fieldName);
      this.showFieldHelp(form, fieldName);
    });

    // Auto-complete
    if (form.fields.get(fieldName).autoComplete) {
      this.setupFieldAutoComplete(form, fieldName, field);
    }

    // Smart defaults
    if (form.fields.get(fieldName).smartDefault) {
      this.applySmartDefault(form, fieldName, field);
    }
  }

  /**
   * Validate field
   */
  validateField(form, fieldName) {
    const fieldData = form.fields.get(fieldName);
    const value = fieldData.element.value;
    const validation = fieldData.validation;

    let errors = [];

    // Required validation
    if (validation.required && !value.trim()) {
      errors.push('This field is required');
    }

    // Type-specific validation
    if (value && validation.type) {
      switch (validation.type) {
        case 'email':
          if (!this.isValidEmail(value)) {
            errors.push('Please enter a valid email address');
          }
          break;
        case 'url':
          if (!this.isValidUrl(value)) {
            errors.push('Please enter a valid URL');
          }
          break;
        case 'did':
          if (!this.isValidDID(value)) {
            errors.push('Please enter a valid DID format');
          }
          break;
        case 'stellar':
          if (!this.isValidStellarAddress(value)) {
            errors.push('Please enter a valid Stellar address');
          }
          break;
      }
    }

    // Length validation
    if (value && validation.minLength && value.length < validation.minLength) {
      errors.push(`Minimum length is ${validation.minLength} characters`);
    }

    if (value && validation.maxLength && value.length > validation.maxLength) {
      errors.push(`Maximum length is ${validation.maxLength} characters`);
    }

    // Pattern validation
    if (value && validation.pattern && !new RegExp(validation.pattern).test(value)) {
      errors.push(validation.patternMessage || 'Invalid format');
    }

    // Custom validation
    if (validation.custom && typeof validation.custom === 'function') {
      const customError = validation.custom(value);
      if (customError) {
        errors.push(customError);
      }
    }

    this.showFieldErrors(form, fieldName, errors);
    return errors.length === 0;
  }

  /**
   * Show field errors
   */
  showFieldErrors(form, fieldName, errors) {
    const fieldData = form.fields.get(fieldName);
    const field = fieldData.element;

    // Remove existing errors
    this.clearFieldError(form, fieldName);

    if (errors.length > 0) {
      field.classList.add('error');
      
      const errorElement = document.createElement('div');
      errorElement.className = 'field-error';
      errorElement.textContent = errors[0]; // Show first error
      errorElement.setAttribute('data-field', fieldName);
      
      field.parentNode.appendChild(errorElement);
    } else {
      field.classList.remove('error');
      field.classList.add('valid');
    }
  }

  /**
   * Clear field error
   */
  clearFieldError(form, fieldName) {
    const field = form.fields.get(fieldName).element;
    field.classList.remove('error', 'valid');
    
    const errorElement = field.parentNode.querySelector(`[data-field="${fieldName}"]`);
    if (errorElement) {
      errorElement.remove();
    }
  }

  /**
   * Show field help
   */
  showFieldHelp(form, fieldName) {
    const fieldData = form.fields.get(fieldName);
    const help = fieldData.validation.help;
    
    if (help) {
      // Implementation for showing help text
    }
  }

  /**
   * Setup auto-complete for field
   */
  setupFieldAutoComplete(form, fieldName, field) {
    const autoCompleteConfig = form.fields.get(fieldName).autoComplete;
    
    // Create auto-complete dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    dropdown.style.display = 'none';
    field.parentNode.appendChild(dropdown);

    field.addEventListener('input', () => {
      const value = field.value;
      if (value.length >= 2) {
        this.showAutoCompleteSuggestions(form, fieldName, value, dropdown);
      } else {
        dropdown.style.display = 'none';
      }
    });

    // Handle selection
    dropdown.addEventListener('click', (e) => {
      if (e.target.classList.contains('autocomplete-item')) {
        field.value = e.target.textContent;
        dropdown.style.display = 'none';
        field.focus();
      }
    });

    // Hide on blur
    field.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.style.display = 'none';
      }, 200);
    });
  }

  /**
   * Show auto-complete suggestions
   */
  showAutoCompleteSuggestions(form, fieldName, value, dropdown) {
    const suggestions = this.getAutoCompleteSuggestions(fieldName, value);
    const sanitizedSuggestions = sanitizeSuggestions(suggestions);
    
    if (sanitizedSuggestions.length > 0) {
      dropdown.innerHTML = sanitizedSuggestions
        .map(suggestion => `<div class="autocomplete-item">${suggestion}</div>`)
        .join('');
      dropdown.style.display = 'block';
    } else {
      dropdown.style.display = 'none';
    }
  }

  /**
   * Get auto-complete suggestions
   */
  getAutoCompleteSuggestions(fieldName, value) {
    const data = this.autoCompleteData.get(fieldName) || [];
    return data
      .filter(item => item.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 5);
  }

  /**
   * Apply smart default
   */
  applySmartDefault(form, fieldName, field) {
    const smartDefault = form.fields.get(fieldName).smartDefault;
    
    if (typeof smartDefault === 'function') {
      const defaultValue = smartDefault();
      if (defaultValue && !field.value) {
        field.value = defaultValue;
      }
    } else if (smartDefault && !field.value) {
      field.value = smartDefault;
    }
  }

  /**
   * Validate entire form
   */
  validateForm(formId) {
    const form = this.forms.get(formId);
    if (!form) return false;

    let isValid = true;
    
    for (const [fieldName] of form.fields) {
      if (!this.validateField(form, fieldName)) {
        isValid = false;
      }
    }

    return isValid;
  }

  /**
   * Get form data
   */
  getFormData(formId) {
    const form = this.forms.get(formId);
    if (!form) return {};

    const data = {};
    
    for (const [fieldName, fieldData] of form.fields) {
      data[fieldName] = fieldData.element.value;
    }

    return data;
  }

  /**
   * Validation helpers
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  isValidDID(did) {
    return /^did:stellar:G[A-Z0-9]{55}$/.test(did);
  }

  isValidStellarAddress(address) {
    return /^G[A-Z0-9]{55}$/.test(address);
  }

  /**
   * Setup global validation
   */
  setupGlobalValidation() {
    // Add global validation styles
    const style = document.createElement('style');
    style.textContent = `
      .field-error {
        color: #dc3545;
        font-size: 0.875rem;
        margin-top: 0.25rem;
      }
      
      .autocomplete-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-top: none;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
      }
      
      .autocomplete-item {
        padding: 0.5rem;
        cursor: pointer;
      }
      
      .autocomplete-item:hover {
        background: #f8f9fa;
      }
      
      input.error, select.error, textarea.error {
        border-color: #dc3545;
      }
      
      input.valid, select.valid, textarea.valid {
        border-color: #28a745;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup auto-complete data
   */
  setupAutoComplete() {
    // Load auto-complete data
    this.autoCompleteData.set('serviceEndpoint', [
      'https://did.example.com',
      'https://identity.example.com',
      'https://hub.example.com'
    ]);
    
    this.autoCompleteData.set('credentialType', [
      'VerifiableCredential',
      'DegreeCredential',
      'EmploymentCredential',
      'IdentityCredential'
    ]);
  }

  /**
   * Setup smart defaults
   */
  setupSmartDefaults() {
    // Smart defaults can be configured per form
  }

  getStatus() {
    return {
      active: true,
      formsRegistered: this.forms.size,
      validatorsLoaded: this.validators.size
    };
  }
}

/**
 * Progressive Loading - Load content progressively for better perceived performance
 */
class ProgressiveLoading {
  constructor() {
    this.loaders = new Map();
    this.loadedContent = new Map();
  }

  async initialize() {
    this.setupIntersectionObserver();
    this.setupLazyLoading();
    console.log('Progressive Loading initialized');
  }

  /**
   * Setup intersection observer for lazy loading
   */
  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadContent(entry.target);
          this.observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '50px'
    });
  }

  /**
   * Setup lazy loading for images and content
   */
  setupLazyLoading() {
    // Lazy load images
    document.querySelectorAll('img[data-src]').forEach(img => {
      this.observer.observe(img);
    });

    // Lazy load content sections
    document.querySelectorAll('[data-lazy-load]').forEach(element => {
      this.observer.observe(element);
    });
  }

  /**
   * Load content
   */
  async loadContent(element) {
    const src = element.dataset.src || element.getAttribute('data-lazy-load');
    const type = element.dataset.type || 'image';

    if (this.loadedContent.has(src)) {
      this.applyContent(element, this.loadedContent.get(src), type);
      return;
    }

    try {
      this.showLoadingState(element);

      let content;
      switch (type) {
        case 'image':
          content = await this.loadImage(src);
          break;
        case 'component':
          content = await this.loadComponent(src);
          break;
        case 'data':
          content = await this.loadData(src);
          break;
        default:
          content = await this.loadGeneric(src);
      }

      this.loadedContent.set(src, content);
      this.applyContent(element, content, type);
    } catch (error) {
      this.showErrorState(element, error);
    }
  }

  /**
   * Load image
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Load component
   */
  async loadComponent(src) {
    const response = await fetch(src);
    const html = await response.text();
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitizeHtml(html);
    
    return tempDiv.firstElementChild;
  }

  /**
   * Load data
   */
  async loadData(src) {
    const response = await fetch(src);
    return await response.json();
  }

  /**
   * Load generic content
   */
  async loadGeneric(src) {
    const response = await fetch(src);
    return await response.text();
  }

  /**
   * Apply loaded content
   */
  applyContent(element, content, type) {
    switch (type) {
      case 'image':
        element.src = content.src;
        element.classList.remove('loading');
        element.classList.add('loaded');
        break;
      case 'component':
        element.parentNode.replaceChild(content, element);
        break;
      case 'data':
        this.renderData(element, content);
        break;
      default:
        element.textContent = content;
    }
  }

  /**
   * Render data
   */
  renderData(element, data) {
    // Use sanitized JSON rendering to prevent XSS
    element.innerHTML = `<pre>${sanitizeJsonForDisplay(data)}</pre>`;
    element.classList.remove('loading');
    element.classList.add('loaded');
  }

  /**
   * Show loading state
   */
  showLoadingState(element) {
    element.classList.add('loading');
    
    if (element.dataset.type === 'image') {
      element.style.opacity = '0.5';
    } else {
      // Use textContent to prevent XSS
      element.textContent = 'Loading...';
    }
  }

  /**
   * Show error state
   */
  showErrorState(element, error) {
    element.classList.remove('loading');
    element.classList.add('error');
    
    if (element.dataset.type === 'image') {
      element.style.opacity = '1';
      element.alt = 'Failed to load';
    } else {
      // Use textContent to prevent XSS
      element.textContent = 'Failed to load content';
    }
    
    console.error('Progressive loading error:', error);
  }

  /**
   * Preload critical content
   */
  async preloadCritical(paths) {
    const promises = paths.map(path => {
      if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return this.loadImage(path);
      } else {
        return fetch(path);
      }
    });

    try {
      await Promise.all(promises);
      console.log('Critical content preloaded');
    } catch (error) {
      console.error('Failed to preload critical content:', error);
    }
  }

  getStatus() {
    return {
      active: true,
      observerActive: !!this.observer,
      contentLoaded: this.loadedContent.size
    };
  }
}

/**
 * Offline Support - Service worker and offline caching
 */
class OfflineSupport {
  constructor() {
    this.isOnline = navigator.onLine;
    this.cachedContent = new Map();
    this.syncQueue = [];
  }

  async initialize() {
    this.setupServiceWorker();
    this.setupOnlineStatusMonitoring();
    this.setupOfflineStorage();
    console.log('Offline Support initialized');
  }

  /**
   * Setup service worker
   */
  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }

  /**
   * Setup online status monitoring
   */
  setupOnlineStatusMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnlineStatus();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOfflineStatus();
    });
  }

  /**
   * Setup offline storage
   */
  setupOfflineStorage() {
    if ('caches' in window) {
      this.cache = caches.open('stellar-did-offline-v1');
    }

    if ('indexedDB' in window) {
      this.setupIndexedDB();
    }
  }

  /**
   * Setup IndexedDB for offline data
   */
  setupIndexedDB() {
    // IndexedDB setup for storing user data, forms, etc.
  }

  /**
   * Handle online status
   */
  handleOnlineStatus() {
    this.showOnlineNotification();
    this.syncOfflineData();
  }

  /**
   * Handle offline status
   */
  handleOfflineStatus() {
    this.showOfflineNotification();
    this.enableOfflineMode();
  }

  /**
   * Show online notification
   */
  showOnlineNotification() {
    this.showNotification('Connection restored', 'success');
  }

  /**
   * Show offline notification
   */
  showOfflineNotification() {
    this.showNotification('Offline mode activated', 'warning');
  }

  /**
   * Enable offline mode
   */
  enableOfflineMode() {
    document.body.classList.add('offline-mode');
  }

  /**
   * Sync offline data
   */
  async syncOfflineData() {
    if (this.syncQueue.length === 0) return;

    try {
      const results = await Promise.allSettled(
        this.syncQueue.map(item => this.syncItem(item))
      );

      this.syncQueue = [];
      document.body.classList.remove('offline-mode');
      
      console.log('Offline data synced:', results);
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }

  /**
   * Sync individual item
   */
  async syncItem(item) {
    // Implementation depends on the type of item
    const response = await fetch(item.url, {
      method: item.method,
      headers: item.headers,
      body: item.body
    });

    return response.json();
  }

  /**
   * Cache content for offline use
   */
  async cacheContent(url, content) {
    try {
      const cache = await this.cache;
      await cache.put(url, new Response(content));
      this.cachedContent.set(url, content);
    } catch (error) {
      console.error('Failed to cache content:', error);
    }
  }

  /**
   * Get cached content
   */
  async getCachedContent(url) {
    try {
      const cache = await this.cache;
      const response = await cache.match(url);
      
      if (response) {
        return await response.text();
      }
    } catch (error) {
      console.error('Failed to get cached content:', error);
    }
    
    return null;
  }

  /**
   * Add item to sync queue
   */
  addToSyncQueue(item) {
    this.syncQueue.push(item);
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // Implementation depends on notification system
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  getStatus() {
    return {
      active: true,
      isOnline: this.isOnline,
      cachedContent: this.cachedContent.size,
      syncQueueLength: this.syncQueue.length
    };
  }
}

/**
 * Accessibility - A11y improvements
 */
class Accessibility {
  constructor() {
    this.settings = {
      highContrast: false,
      largeText: false,
      reducedMotion: false,
      screenReader: false
    };
  }

  async initialize() {
    this.setupKeyboardNavigation();
    this.setupAriaLabels();
    this.setupFocusManagement();
    this.setupScreenReaderSupport();
    this.loadUserPreferences();
    console.log('Accessibility initialized');
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    // Skip to main content link
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link';
    document.body.insertBefore(skipLink, document.body.firstChild);

    // Focus indicators
    this.setupFocusIndicators();

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Setup focus indicators
   */
  setupFocusIndicators() {
    const style = document.createElement('style');
    style.textContent = `
      :focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
      }
      
      .skip-link {
        position: absolute;
        top: -40px;
        left: 6px;
        background: #007bff;
        color: white;
        padding: 8px;
        text-decoration: none;
        z-index: 10000;
      }
      
      .skip-link:focus {
        top: 6px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Alt + S: Skip to main
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        document.getElementById('main-content')?.focus();
      }

      // Alt + H: Go to home
      if (e.altKey && e.key === 'h') {
        e.preventDefault();
        window.location.href = '/';
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });
  }

  /**
   * Setup ARIA labels
   */
  setupAriaLabels() {
    // Add ARIA labels to interactive elements
    document.querySelectorAll('button:not([aria-label])').forEach(button => {
      if (!button.textContent.trim()) {
        button.setAttribute('aria-label', 'Button');
      }
    });

    // Add landmarks
    this.addLandmarks();

    // Add live regions
    this.addLiveRegions();
  }

  /**
   * Add semantic landmarks
   */
  addLandmarks() {
    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main && !main.getAttribute('role')) {
      main.setAttribute('role', 'main');
    }

    const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
    if (nav && !nav.getAttribute('role')) {
      nav.setAttribute('role', 'navigation');
    }

    const header = document.querySelector('header') || document.querySelector('[role="banner"]');
    if (header && !header.getAttribute('role')) {
      header.setAttribute('role', 'banner');
    }

    const footer = document.querySelector('footer') || document.querySelector('[role="contentinfo"]');
    if (footer && !footer.getAttribute('role')) {
      footer.setAttribute('role', 'contentinfo');
    }
  }

  /**
   * Add live regions for screen readers
   */
  addLiveRegions() {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only live-region';
    document.body.appendChild(liveRegion);

    this.liveRegion = liveRegion;
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    // Modal focus trapping
    this.setupModalFocusManagement();

    // Tab order management
    this.setupTabOrderManagement();
  }

  /**
   * Setup modal focus management
   */
  setupModalFocusManagement() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const modal = document.querySelector('.modal[aria-hidden="false"]');
        if (modal) {
          this.trapFocus(e, modal);
        }
      }
    });
  }

  /**
   * Trap focus within modal
   */
  trapFocus(e, modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }

  /**
   * Setup tab order management
   */
  setupTabOrderManagement() {
    // Ensure logical tab order
    // Add tabindex where needed
  }

  /**
   * Setup screen reader support
   */
  setupScreenReaderSupport() {
    // Add screen reader specific enhancements
    this.setupScreenReaderAnnouncements();
  }

  /**
   * Setup screen reader announcements
   */
  setupScreenReaderAnnouncements() {
    // Announce important changes
    this.announce = (message) => {
      if (this.liveRegion) {
        this.liveRegion.textContent = message;
        setTimeout(() => {
          this.liveRegion.textContent = '';
        }, 1000);
      }
    };
  }

  /**
   * Load user preferences
   */
  loadUserPreferences() {
    const saved = localStorage.getItem('accessibility-settings');
    if (saved) {
      const preferences = JSON.parse(saved);
      this.updateSettings(preferences);
    }

    // Detect system preferences
    this.detectSystemPreferences();
  }

  /**
   * Detect system preferences
   */
  detectSystemPreferences() {
    // Detect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.settings.reducedMotion = true;
      document.body.classList.add('reduced-motion');
    }

    // Detect high contrast
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      this.settings.highContrast = true;
      document.body.classList.add('high-contrast');
    }
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    Object.assign(this.settings, newSettings);
    this.applySettings();
    this.saveSettings();
  }

  /**
   * Apply settings
   */
  applySettings() {
    document.body.classList.toggle('high-contrast', this.settings.highContrast);
    document.body.classList.toggle('large-text', this.settings.largeText);
    document.body.classList.toggle('reduced-motion', this.settings.reducedMotion);
  }

  /**
   * Save settings
   */
  saveSettings() {
    localStorage.setItem('accessibility-settings', JSON.stringify(this.settings));
  }

  /**
   * Close all modals
   */
  closeAllModals() {
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(modal => {
      modal.setAttribute('aria-hidden', 'true');
      modal.style.display = 'none';
    });
  }

  getStatus() {
    return {
      active: true,
      settings: this.settings,
      screenReaderActive: this.settings.screenReader
    };
  }
}

/**
 * Performance Optimizer - Monitor and optimize performance
 */
class PerformanceOptimizer {
  constructor() {
    this.metrics = {
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      firstInputDelay: 0,
      cumulativeLayoutShift: 0
    };
    this.observers = [];
  }

  async initialize() {
    this.setupPerformanceMonitoring();
    this.setupResourceOptimization();
    this.setupImageOptimization();
    console.log('Performance Optimizer initialized');
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      this.observeWebVitals();
      this.observeResourceTiming();
      this.observeLongTasks();
    }

    // Monitor page load
    window.addEventListener('load', () => {
      this.recordPageLoadMetrics();
    });
  }

  /**
   * Observe Web Vitals
   */
  observeWebVitals() {
    // First Contentful Paint
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcp = entries[entry => entry.name === 'first-contentful-paint'];
      if (fcp) {
        this.metrics.firstContentfulPaint = fcp.startTime;
      }
    });
    fcpObserver.observe({ entryTypes: ['paint'] });
    this.observers.push(fcpObserver);

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lcp = entries[entries.length - 1];
      this.metrics.largestContentfulPaint = lcp.startTime;
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    this.observers.push(lcpObserver);

    // First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fid = entries[0];
      this.metrics.firstInputDelay = fid.processingStart - fid.startTime;
    });
    fidObserver.observe({ entryTypes: ['first-input'] });
    this.observers.push(fidObserver);

    // Cumulative Layout Shift
    const clsObserver = new PerformanceObserver((list) => {
      let clsValue = 0;
      list.getEntries().forEach(entry => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      this.metrics.cumulativeLayoutShift += clsValue;
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
    this.observers.push(clsObserver);
  }

  /**
   * Observe resource timing
   */
  observeResourceTiming() {
    const resourceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        this.analyzeResourcePerformance(entry);
      });
    });
    resourceObserver.observe({ entryTypes: ['resource'] });
    this.observers.push(resourceObserver);
  }

  /**
   * Observe long tasks
   */
  observeLongTasks() {
    const longTaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        console.warn('Long task detected:', {
          duration: entry.duration,
          startTime: entry.startTime
        });
      });
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });
    this.observers.push(longTaskObserver);
  }

  /**
   * Record page load metrics
   */
  recordPageLoadMetrics() {
    if ('performance' in window && 'timing' in performance) {
      const timing = performance.timing;
      const pageLoad = {
        dns: timing.domainLookupEnd - timing.domainLookupStart,
        tcp: timing.connectEnd - timing.connectStart,
        request: timing.responseStart - timing.requestStart,
        response: timing.responseEnd - timing.responseStart,
        dom: timing.domContentLoadedEventStart - timing.navigationStart,
        load: timing.loadEventEnd - timing.navigationStart
      };

      console.log('Page load metrics:', pageLoad);
    }
  }

  /**
   * Analyze resource performance
   */
  analyzeResourcePerformance(entry) {
    if (entry.duration > 1000) {
      console.warn('Slow resource detected:', {
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize
      });
    }
  }

  /**
   * Setup resource optimization
   */
  setupResourceOptimization() {
    // Preload critical resources
    this.preloadCriticalResources();

    // Optimize font loading
    this.optimizeFontLoading();

    // Optimize CSS loading
    this.optimizeCSSLoading();
  }

  /**
   * Preload critical resources
   */
  preloadCriticalResources() {
    const criticalResources = [
      '/fonts/main.woff2',
      '/css/critical.css',
      '/js/critical.js'
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      
      if (resource.endsWith('.woff2')) {
        link.as = 'font';
        link.type = 'font/woff2';
        link.crossOrigin = 'anonymous';
      } else if (resource.endsWith('.css')) {
        link.as = 'style';
      } else if (resource.endsWith('.js')) {
        link.as = 'script';
      }

      document.head.appendChild(link);
    });
  }

  /**
   * Optimize font loading
   */
  optimizeFontLoading() {
    // Add font-display: swap to existing fonts
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Optimize CSS loading
   */
  optimizeCSSLoading() {
    // Load non-critical CSS asynchronously
    const nonCriticalCSS = [
      '/css/non-critical.css'
    ];

    nonCriticalCSS.forEach(cssFile => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = cssFile;
      link.onload = function() {
        this.rel = 'stylesheet';
      };
      document.head.appendChild(link);
    });
  }

  /**
   * Setup image optimization
   */
  setupImageOptimization() {
    // Add lazy loading to images
    document.querySelectorAll('img').forEach(img => {
      if (!img.loading) {
        img.loading = 'lazy';
      }
    });

    // Use WebP format if supported
    if (this.supportsWebP()) {
      this.convertImagesToWebP();
    }
  }

  /**
   * Check WebP support
   */
  supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  /**
   * Convert images to WebP
   */
  convertImagesToWebP() {
    document.querySelectorAll('img[src*=".jpg"], img[src*=".png"]').forEach(img => {
      const webpSrc = img.src.replace(/\.(jpg|jpeg|png)$/, '.webp');
      
      // Create a new image to test WebP support
      const testImg = new Image();
      testImg.onload = function() {
        img.src = webpSrc;
      };
      testImg.onerror = function() {
        // Keep original format if WebP fails
      };
      testImg.src = webpSrc;
    });
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      observersActive: this.observers.length
    };
  }

  getStatus() {
    return {
      active: true,
      metrics: this.getMetrics()
    };
  }
}

// Additional UX features would be implemented similarly...

module.exports = UXOptimizer;
