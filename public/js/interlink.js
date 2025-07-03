(function() {
  'use strict';

  // Configuration
  const INTERLINK_CONFIG = {
    apiBaseUrl: 'https://your-domain.vercel.app/api/public/cards',
    cacheKey: 'interlink_cards_cache',
    cacheExpiry: 5 * 60 * 1000, // 5 minutes in milliseconds
    placeholderPattern: /\{\{Card:([^}|]+)(\|custom=([^}]+))?\}\}/g
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
        return customText || '{{Card:' + key + '}}';
      }
    }, options || {});
    
    this.cards = null;
    this.isLoading = false;
  }

  Interlink.prototype = {
    // Fetch cards from API
    fetchCards: function() {
      const self = this;
      const cacheKey = INTERLINK_CONFIG.cacheKey + '_' + this.userId;
      
      // Check cache first
      const cachedCards = Cache.get(cacheKey);
      if (cachedCards) {
        this.cards = cachedCards;
        return Promise.resolve(cachedCards);
      }

      // Return existing promise if already loading
      if (this.isLoading) {
        return this.loadingPromise;
      }

      this.isLoading = true;
      this.loadingPromise = fetch(INTERLINK_CONFIG.apiBaseUrl + '/' + this.userId)
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Failed to fetch cards: ' + response.status);
          }
          return response.json();
        })
        .then(function(cards) {
          self.cards = cards;
          self.isLoading = false;
          
          // Cache the results
          Cache.set(cacheKey, cards, INTERLINK_CONFIG.cacheExpiry);
          
          return cards;
        })
        .catch(function(error) {
          self.isLoading = false;
          console.warn('Interlink: Failed to fetch cards', error);
          return [];
        });

      return this.loadingPromise;
    },

    // Find card by key
    findCard: function(key) {
      if (!this.cards) return null;
      return this.cards.find(function(card) {
        return card.key === key;
      });
    },

    // Generate replacement HTML
    generateReplacement: function(card, customText) {
      const displayText = customText || card.display_name;
      return '<a href="' + this.escapeHtml(card.terms_url) + '" target="_blank" rel="nofollow">' + 
             this.escapeHtml(displayText) + ' (terms)</a>';
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
        const card = self.findCard(key);
        if (card) {
          return self.generateReplacement(card, customText);
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
      if (!this.cards) {
        console.warn('Interlink: No cards loaded');
        return;
      }

      // Process the body content
      this.processNode(document.body);
    },

    // Initialize and run replacement
    init: function() {
      const self = this;
      
      this.fetchCards().then(function() {
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