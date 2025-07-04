(function() {
  'use strict';

  // Auto-detect base URL from script tag
  function getBaseUrl() {
    const script = document.querySelector('script[data-user-id]');
    if (script && script.src) {
      const url = new URL(script.src);
      return url.origin;
    }
    // Fallback to current domain if auto-detection fails
    return window.location.origin;
  }

  // Configuration
  const INTERLINK_CONFIG = {
    apiBaseUrl: getBaseUrl() + '/api/public/links',
    cacheKey: 'interlink_links_cache',
    cacheExpiry: 5 * 60 * 1000, // 5 minutes in milliseconds
    placeholderPattern: /\{\{([^}|]+)(\|custom=([^}]+))?\}\}/g
  };

  // Cache management
  const Cache = {
    get: function(key) {
      try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        const data = JSON.parse(item);
        if (Date.now() > data.expiry) {
          localStorage.removeItem(key);
          return null;
        }
        return data.value;
      } catch (e) {
        return null;
      }
    },

    set: function(key, value, ttl) {
      try {
        const item = {
          value: value,
          expiry: Date.now() + ttl
        };
        localStorage.setItem(key, JSON.stringify(item));
      } catch (e) {
        // Silently fail if localStorage is not available
      }
    }
  };

  // Main Interlink class
  function Interlink(userId, options) {
    this.userId = userId;
    this.options = Object.assign({
      replaceAll: true,
      customFallback: function(key, customText) {
        return customText || '{{' + key + '}}';
      }
    }, options || {});
    
    this.links = null;
    this.isLoading = false;
  }

  Interlink.prototype = {
    // Fetch links from API
    fetchLinks: function() {
      const self = this;
      const cacheKey = INTERLINK_CONFIG.cacheKey + '_' + this.userId;
      
      // Check cache first
      const cachedLinks = Cache.get(cacheKey);
      if (cachedLinks) {
        this.links = cachedLinks;
        return Promise.resolve(cachedLinks);
      }

      // Return existing promise if already loading
      if (this.isLoading) {
        return this.loadingPromise;
      }

      this.isLoading = true;
      this.loadingPromise = fetch(INTERLINK_CONFIG.apiBaseUrl + '/' + this.userId)
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Failed to fetch links: ' + response.status);
          }
          return response.json();
        })
        .then(function(links) {
          self.links = links;
          self.isLoading = false;
          
          // Cache the results
          Cache.set(cacheKey, links, INTERLINK_CONFIG.cacheExpiry);
          
          return links;
        })
        .catch(function(error) {
          self.isLoading = false;
          console.warn('Interlink: Failed to fetch links', error);
          return [];
        });

      return this.loadingPromise;
    },

    // Find link by key
    findLink: function(key) {
      if (!this.links) return null;
      return this.links.find(function(link) {
        return link.key === key;
      });
    },

    // Generate replacement HTML
    generateReplacement: function(link, customText) {
      const displayText = customText || link.displayName;
      
      // Only add hyperlink if URL is provided
      if (link.url && link.url.trim()) {
        return '<a href="' + this.escapeHtml(link.url) + '" target="_blank" rel="nofollow">' + 
               this.escapeHtml(displayText) + '</a>';
      } else {
        return this.escapeHtml(displayText);
      }
    },

    // Escape HTML to prevent XSS
    escapeHtml: function(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    // Replace placeholders in text
    replacePlaceholders: function(text) {
      const self = this;
      return text.replace(INTERLINK_CONFIG.placeholderPattern, function(match, key, customParam, customText) {
        const link = self.findLink(key);
        if (link) {
          return self.generateReplacement(link, customText);
        } else {
          // Use fallback function
          return self.options.customFallback(key, customText);
        }
      });
    },

    // Process DOM nodes
    processNode: function(node) {
      const self = this;
      
      if (node.nodeType === Node.TEXT_NODE) {
        const originalText = node.textContent;
        const replacedText = this.replacePlaceholders(originalText);
        
        if (originalText !== replacedText) {
          // Create a temporary container
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = replacedText;
          
          // Replace the text node with the new content
          const fragment = document.createDocumentFragment();
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }
          
          node.parentNode.replaceChild(fragment, node);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip script and style tags
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
          return;
        }
        
        // Process child nodes
        const childNodes = Array.from(node.childNodes);
        childNodes.forEach(function(child) {
          self.processNode(child);
        });
      }
    },

    // Process the entire document
    processDocument: function() {
      if (!this.links) {
        console.warn('Interlink: No links loaded');
        return;
      }

      // Process the body content
      this.processNode(document.body);
    },

    // Initialize and run replacement
    init: function() {
      const self = this;
      
      this.fetchLinks().then(function() {
        self.processDocument();
      });
    }
  };

  // Auto-initialize if data-user-id is found
  function autoInit() {
    const script = document.querySelector('script[data-user-id]');
    if (script) {
      const userId = script.getAttribute('data-user-id');
      const replaceAll = script.getAttribute('data-replace-all') !== 'false';
      
      if (userId) {
        const interlink = new Interlink(userId, {
          replaceAll: replaceAll
        });
        
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            interlink.init();
          });
        } else {
          interlink.init();
        }
      }
    }
  }

  // Expose to global scope
  window.Interlink = Interlink;
  
  // Auto-initialize
  autoInit();
})();