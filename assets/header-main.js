/**
 * Header Main JavaScript
 * Handles all interactive behavior for the custom Shopify header section:
 * - Sticky header with scroll direction detection
 * - Mega menu hover with delay and keyboard support
 * - Mobile drawer open/close with body scroll lock
 * - Accordion navigation for mobile sub-menus (3 levels)
 * - Search overlay
 * - Shopify Theme Editor event handlers
 *
 * Dependencies: None (vanilla JS, no jQuery)
 * Compatibility: ES6+, loaded via <script defer>
 */

/* ==========================================================================
   0. Shared Scroll Lock Utility
   ========================================================================== */

const ScrollLock = {
  _count: 0,
  lock() {
    this._count++;
    if (this._count === 1) {
      document.body.style.overflow = 'hidden';
    }
  },
  unlock() {
    this._count = Math.max(0, this._count - 1);
    if (this._count === 0) {
      document.body.style.overflow = '';
    }
  }
};

/* ==========================================================================
   1. StickyHeader Custom Element
   ========================================================================== */

/**
 * Custom element that manages sticky header behavior.
 * Supports two modes via data-sticky-type attribute:
 * - 'on-scroll-up': Shows sticky header when user scrolls up
 * - 'always': Always shows sticky header when scrolled past original position
 * - 'none': No sticky behavior
 *
 * Uses IntersectionObserver on a sentinel element to detect when the header
 * leaves the viewport, then applies sticky classes accordingly.
 */
class StickyHeader extends HTMLElement {
  constructor() {
    super();
    this.headerWrapper = null;
    this.sentinel = null;
    this.observer = null;
    this.scrollHandler = null;
    this.lastScrollTop = 0;
    this.isSticky = false;
    this.ticking = false;
    this.stickyType = 'none';
  }

  connectedCallback() {
    this.stickyType = this.getAttribute('data-sticky-type') || 'none';

    if (this.stickyType === 'none') return;

    this.headerWrapper = this.querySelector('.header-wrapper');
    if (!this.headerWrapper) return;

    // Create or find sentinel element for IntersectionObserver
    this.sentinel = this.querySelector('.header-sentinel');
    if (!this.sentinel) {
      this.sentinel = document.createElement('div');
      this.sentinel.classList.add('header-sentinel');
      this.sentinel.style.position = 'absolute';
      this.sentinel.style.top = '0';
      this.sentinel.style.left = '0';
      this.sentinel.style.width = '1px';
      this.sentinel.style.height = '1px';
      this.sentinel.style.pointerEvents = 'none';
      this.prepend(this.sentinel);
    }

    this.setupObserver();

    if (this.stickyType === 'on-scroll-up') {
      this.setupScrollListener();
    }
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
  }

  /**
   * Sets up IntersectionObserver to detect when the header sentinel
   * leaves the viewport (header scrolled past).
   */
  setupObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isSticky = !entry.isIntersecting;

          if (this.isSticky) {
            this.headerWrapper.classList.add('header--sticky');

            if (this.stickyType === 'always') {
              this.headerWrapper.classList.add('header--sticky-visible');
              this.headerWrapper.classList.add('header--has-shadow');
            }
          } else {
            this.headerWrapper.classList.remove('header--sticky');
            this.headerWrapper.classList.remove('header--sticky-visible');
            this.headerWrapper.classList.remove('header--has-shadow');
          }
        });
      },
      { threshold: 0 }
    );

    this.observer.observe(this.sentinel);
  }

  /**
   * Sets up a scroll listener throttled with requestAnimationFrame
   * to detect scroll direction for the 'on-scroll-up' mode.
   */
  setupScrollListener() {
    this.scrollHandler = () => {
      if (!this.ticking) {
        requestAnimationFrame(() => {
          this.onScroll();
          this.ticking = false;
        });
        this.ticking = true;
      }
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  /**
   * Handles scroll direction detection.
   * On scroll up: shows sticky header.
   * On scroll down: hides sticky header.
   */
  onScroll() {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (!this.isSticky) {
      this.lastScrollTop = currentScrollTop;
      return;
    }

    if (currentScrollTop < this.lastScrollTop) {
      // Scrolling up - show sticky header
      this.headerWrapper.classList.add('header--sticky-visible');
      this.headerWrapper.classList.add('header--has-shadow');
    } else {
      // Scrolling down - hide sticky header
      this.headerWrapper.classList.remove('header--sticky-visible');
      this.headerWrapper.classList.remove('header--has-shadow');
    }

    this.lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop;
  }
}

/* ==========================================================================
   2. MegaMenu Class
   ========================================================================== */

/**
 * Controls mega menu hover behavior with configurable delay.
 * Handles mouseenter/mouseleave on triggers and panels with a 200ms
 * close delay to prevent flickering. Includes keyboard support for
 * Enter/Space toggle, Escape close, and focus trapping.
 */
class MegaMenu {
  /**
   * @param {HTMLElement} container - The header container element
   */
  constructor(container) {
    if (!container) return;

    this.container = container;
    this.triggers = container.querySelectorAll('[data-mega-trigger]');
    this.panels = container.querySelectorAll('[data-mega-panel]');
    this.closeTimeout = null;
    this.closeDelay = 200;
    this.activeTrigger = null;

    this.init();
  }

  init() {
    this.triggers.forEach((trigger) => {
      const panelId = trigger.getAttribute('data-mega-trigger');

      trigger.addEventListener('mouseenter', () => {
        this.clearCloseTimeout();
        this.openPanel(panelId, trigger);
      });

      trigger.addEventListener('mouseleave', () => {
        this.scheduleClose();
      });

      // Keyboard support
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const isOpen = trigger.getAttribute('aria-expanded') === 'true';
          if (isOpen) {
            this.closePanel(panelId, trigger);
          } else {
            this.openPanel(panelId, trigger);
          }
        }

        if (e.key === 'Escape') {
          this.closeAll();
          if (this.activeTrigger) {
            this.activeTrigger.focus();
            this.activeTrigger = null;
          }
        }
      });
    });

    this.panels.forEach((panel) => {
      panel.addEventListener('mouseenter', () => {
        this.clearCloseTimeout();
      });

      panel.addEventListener('mouseleave', () => {
        this.scheduleClose();
      });

      // Keyboard support within panel
      panel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeAll();
          if (this.activeTrigger) {
            this.activeTrigger.focus();
            this.activeTrigger = null;
          }
        }

        // Focus trap: Tab cycles through panel links
        if (e.key === 'Tab') {
          this.handleFocusTrap(e, panel);
        }
      });
    });

    // Click outside closes all panels
    this.handleDocumentClick = (e) => {
      if (!this.container.contains(e.target)) {
        this.closeAll();
      }
    };
    document.addEventListener('click', this.handleDocumentClick);
  }

  /**
   * Opens a mega menu panel by its ID.
   * @param {string} panelId - The data-mega-panel value
   * @param {HTMLElement} trigger - The trigger element
   */
  openPanel(panelId, trigger) {
    this.closeAll();
    const panel = this.container.querySelector(`[data-mega-panel="${panelId}"]`);
    if (panel) {
      panel.classList.add('mega-menu--active');
      panel.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      this.activeTrigger = trigger;
    }
  }

  /**
   * Closes a specific mega menu panel.
   * @param {string} panelId - The data-mega-panel value
   * @param {HTMLElement} trigger - The trigger element
   */
  closePanel(panelId, trigger) {
    const panel = this.container.querySelector(`[data-mega-panel="${panelId}"]`);
    if (panel) {
      panel.classList.remove('mega-menu--active');
      panel.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
    }
  }

  /** Closes all open mega menu panels. */
  closeAll() {
    this.panels.forEach((panel) => {
      panel.classList.remove('mega-menu--active');
      panel.setAttribute('aria-hidden', 'true');
    });
    this.triggers.forEach((trigger) => {
      trigger.setAttribute('aria-expanded', 'false');
    });
  }

  /** Schedules panel close after delay. */
  scheduleClose() {
    this.closeTimeout = setTimeout(() => {
      this.closeAll();
    }, this.closeDelay);
  }

  /** Clears any pending close timeout. */
  clearCloseTimeout() {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
  }

  /**
   * Traps focus within an open mega menu panel.
   * @param {KeyboardEvent} e - The keydown event
   * @param {HTMLElement} panel - The active panel
   */
  handleFocusTrap(e, panel) {
    const focusableElements = panel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  /** Cleans up event listeners. */
  destroy() {
    document.removeEventListener('click', this.handleDocumentClick);
    this.clearCloseTimeout();
  }
}

/* ==========================================================================
   3. MobileDrawer Custom Element
   ========================================================================== */

/**
 * Custom element for the mobile navigation drawer.
 * Handles open/close with body scroll lock, backdrop click,
 * Escape key, and focus management.
 */
class MobileDrawer extends HTMLElement {
  constructor() {
    super();
    this.openTriggers = [];
    this.closeTriggers = [];
    this.backdrop = null;
    this.triggerElement = null;
    this.isOpen = false;
    this._openHandlers = new Map();

    this.boundClose = this.close.bind(this);
    this.boundKeydown = this.handleKeydown.bind(this);
  }

  connectedCallback() {
    // External open triggers (outside the drawer, in header)
    this.openTriggers = document.querySelectorAll('[data-drawer-open]');
    // Close triggers inside the drawer
    this.closeTriggers = this.querySelectorAll('[data-drawer-close]');
    // Backdrop element
    this.backdrop = this.querySelector('.mobile-drawer__backdrop');

    this.openTriggers.forEach((trigger) => {
      const handler = (e) => {
        e.preventDefault();
        this.triggerElement = trigger;
        this.open();
      };
      this._openHandlers.set(trigger, handler);
      trigger.addEventListener('click', handler);
    });

    this.closeTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
      });
    });

    if (this.backdrop) {
      this.backdrop.addEventListener('click', this.boundClose);
    }

    document.addEventListener('keydown', this.boundKeydown);
  }

  disconnectedCallback() {
    this._openHandlers.forEach((handler, trigger) => {
      trigger.removeEventListener('click', handler);
    });
    this._openHandlers.clear();

    if (this.backdrop) {
      this.backdrop.removeEventListener('click', this.boundClose);
    }

    document.removeEventListener('keydown', this.boundKeydown);
  }

  /** Opens the mobile drawer with scroll lock and focus management. */
  open() {
    this.isOpen = true;
    this.classList.add('mobile-drawer--open');
    ScrollLock.lock();

    // Update ARIA attributes
    if (this.triggerElement) {
      this.triggerElement.setAttribute('aria-expanded', 'true');
    }
    this.setAttribute('aria-hidden', 'false');

    // Move focus to close button or first focusable element
    const closeBtn = this.querySelector('[data-drawer-close]');
    const firstFocusable = this.querySelector(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (closeBtn) {
      closeBtn.focus();
    } else if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  /** Closes the mobile drawer and restores scroll/focus. */
  close() {
    this.isOpen = false;
    this.classList.remove('mobile-drawer--open');
    ScrollLock.unlock();

    // Update ARIA attributes
    if (this.triggerElement) {
      this.triggerElement.setAttribute('aria-expanded', 'false');
    }
    this.setAttribute('aria-hidden', 'true');

    // Return focus to the trigger element
    if (this.triggerElement) {
      this.triggerElement.focus();
    }
  }

  /**
   * Handles keydown events for Escape key close.
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }
}

/* ==========================================================================
   4. MobileAccordion Class
   ========================================================================== */

/**
 * Controls accordion behavior for mobile navigation.
 * Supports up to 3 levels of nesting. Animates content expand/collapse
 * using max-height transitions. Optionally closes sibling accordions
 * when one opens (single-open mode via data-accordion-single attribute).
 */
class MobileAccordion {
  /**
   * @param {HTMLElement} container - The accordion container element
   */
  constructor(container) {
    if (!container) return;

    this.container = container;
    this.triggers = container.querySelectorAll('[data-accordion-trigger]');
    this.singleOpen = container.hasAttribute('data-accordion-single');

    this.init();
  }

  init() {
    this.triggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle(trigger);
      });
    });
  }

  /**
   * Toggles an accordion panel open or closed.
   * @param {HTMLElement} trigger - The accordion trigger button
   */
  toggle(trigger) {
    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    const contentId = trigger.getAttribute('aria-controls');
    const content = contentId
      ? document.getElementById(contentId)
      : trigger.nextElementSibling;

    if (!content) return;

    if (isExpanded) {
      this.closeItem(trigger, content);
    } else {
      // Optionally close siblings in single-open mode
      if (this.singleOpen) {
        this.closeSiblings(trigger);
      }
      this.openItem(trigger, content);
    }
  }

  /**
   * Opens an accordion item with smooth max-height animation.
   * @param {HTMLElement} trigger - The trigger button
   * @param {HTMLElement} content - The content panel
   */
  openItem(trigger, content) {
    trigger.setAttribute('aria-expanded', 'true');
    content.style.maxHeight = content.scrollHeight + 'px';
    content.classList.add('mobile-accordion__content--open');

    // Update max-height after nested content changes
    content.addEventListener('transitionend', () => {
      if (trigger.getAttribute('aria-expanded') === 'true') {
        content.style.maxHeight = 'none';
      }
    }, { once: true });
  }

  /**
   * Closes an accordion item.
   * @param {HTMLElement} trigger - The trigger button
   * @param {HTMLElement} content - The content panel
   */
  closeItem(trigger, content) {
    trigger.setAttribute('aria-expanded', 'false');
    // Set explicit height before transitioning to 0 for smooth animation
    content.style.maxHeight = content.scrollHeight + 'px';
    // Force reflow
    content.offsetHeight; // eslint-disable-line no-unused-expressions
    content.style.maxHeight = '0';
    content.classList.remove('mobile-accordion__content--open');
  }

  /**
   * Closes sibling accordion items at the same level.
   * @param {HTMLElement} activeTrigger - The trigger that was just opened
   */
  closeSiblings(activeTrigger) {
    const parentItem = activeTrigger.closest('.mobile-accordion__item');
    if (!parentItem) return;

    const parentList = parentItem.parentElement;
    if (!parentList) return;

    const siblingTriggers = parentList.querySelectorAll(
      ':scope > .mobile-accordion__item > [data-accordion-trigger]'
    );

    siblingTriggers.forEach((sibling) => {
      if (sibling !== activeTrigger && sibling.getAttribute('aria-expanded') === 'true') {
        const contentId = sibling.getAttribute('aria-controls');
        const content = contentId
          ? document.getElementById(contentId)
          : sibling.nextElementSibling;

        if (content) {
          this.closeItem(sibling, content);
        }
      }
    });
  }

  /** Cleans up event listeners. */
  destroy() {
    this.triggers.forEach((trigger) => {
      trigger.replaceWith(trigger.cloneNode(true));
    });
  }
}

/* ==========================================================================
   5. SearchOverlay Class
   ========================================================================== */

/**
 * Controls the search overlay open/close behavior.
 * Focuses the search input on open, closes on Escape key
 * or clicking the backdrop area.
 */
class SearchOverlay {
  /**
   * @param {HTMLElement} overlay - The search overlay element
   */
  constructor(overlay) {
    if (!overlay) return;

    this.overlay = overlay;
    this.input = overlay.querySelector('.search-overlay__input');
    this.openTriggers = document.querySelectorAll('[data-search-open]');
    this.closeTriggers = overlay.querySelectorAll('[data-search-close], .search-overlay__close');
    this.triggerElement = null;
    this.isOpen = false;

    this.boundKeydown = this.handleKeydown.bind(this);
    this.boundOverlayClick = this.handleOverlayClick.bind(this);

    this.init();
  }

  init() {
    this.openTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        this.triggerElement = trigger;
        this.open();
      });
    });

    this.closeTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
      });
    });

    this.overlay.addEventListener('click', this.boundOverlayClick);
    document.addEventListener('keydown', this.boundKeydown);
  }

  /** Opens the search overlay and focuses the input. */
  open() {
    this.isOpen = true;
    this.overlay.classList.add('search-overlay--active');
    ScrollLock.lock();

    if (this.input) {
      // Small delay to allow CSS transition to start before focusing
      setTimeout(() => {
        this.input.focus();
      }, 100);
    }
  }

  /** Closes the search overlay and restores focus. */
  close() {
    this.isOpen = false;
    this.overlay.classList.remove('search-overlay--active');
    ScrollLock.unlock();

    if (this.triggerElement) {
      this.triggerElement.focus();
    }
  }

  /**
   * Closes overlay when clicking the backdrop (overlay itself, not inner content).
   * @param {MouseEvent} e
   */
  handleOverlayClick(e) {
    if (e.target === this.overlay) {
      this.close();
    }
  }

  /**
   * Handles Escape key to close the overlay.
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }

  /** Cleans up event listeners. */
  destroy() {
    this.overlay.removeEventListener('click', this.boundOverlayClick);
    document.removeEventListener('keydown', this.boundKeydown);
  }
}

/* ==========================================================================
   6. Shopify Editor Event Handlers
   ========================================================================== */

/**
 * Handles Shopify Theme Editor events for live preview support.
 * Ensures components are re-initialized when sections are loaded/unloaded
 * and that mega menus respond to block select/deselect in the customizer.
 */
function setupEditorEvents() {
  // Re-initialize components when a section is loaded in the editor
  document.addEventListener('shopify:section:load', (e) => {
    const section = e.target;
    if (!section) return;

    const headerContainer = section.querySelector('.header__container');
    if (headerContainer) {
      // Re-init MegaMenu for this section
      if (window.__headerMegaMenu) {
        window.__headerMegaMenu.destroy();
      }
      window.__headerMegaMenu = new MegaMenu(headerContainer);
    }

    // Re-init MobileAccordion
    const drawerContent = section.querySelector('.mobile-drawer__content');
    if (drawerContent) {
      if (window.__headerAccordion) {
        window.__headerAccordion.destroy();
      }
      window.__headerAccordion = new MobileAccordion(drawerContent);
    }

    // Re-init SearchOverlay
    const searchOverlay = section.querySelector('.search-overlay');
    if (searchOverlay) {
      if (window.__headerSearch) {
        window.__headerSearch.destroy();
      }
      window.__headerSearch = new SearchOverlay(searchOverlay);
    }
  });

  // Cleanup when a section is unloaded
  document.addEventListener('shopify:section:unload', (e) => {
    const section = e.target;
    if (!section) return;

    // Disconnect sticky header observer if present
    const stickyEl = section.querySelector('sticky-header');
    if (stickyEl && stickyEl.disconnectedCallback) {
      stickyEl.disconnectedCallback();
    }

    if (window.__headerMegaMenu) {
      window.__headerMegaMenu.destroy();
      window.__headerMegaMenu = null;
    }

    if (window.__headerSearch) {
      window.__headerSearch.destroy();
      window.__headerSearch = null;
    }
  });

  // Open the relevant mega menu panel when a block is selected in the editor
  document.addEventListener('shopify:block:select', (e) => {
    const block = e.target;
    if (!block) return;

    // Check if this block is a mega menu panel or contains one
    const panel = block.closest('[data-mega-panel]') || block.querySelector('[data-mega-panel]');
    if (panel && window.__headerMegaMenu) {
      const panelId = panel.getAttribute('data-mega-panel');
      const trigger = document.querySelector(`[data-mega-trigger="${panelId}"]`);
      if (trigger) {
        window.__headerMegaMenu.openPanel(panelId, trigger);
      }
    }

    // Handle accordion blocks in mobile drawer
    const accordionTrigger = block.querySelector('[data-accordion-trigger]');
    if (accordionTrigger && window.__headerAccordion) {
      window.__headerAccordion.toggle(accordionTrigger);
    }
  });

  // Close all mega menu panels when a block is deselected
  document.addEventListener('shopify:block:deselect', () => {
    if (window.__headerMegaMenu) {
      window.__headerMegaMenu.closeAll();
    }
  });
}

/* ==========================================================================
   7. Initialization
   ========================================================================== */

/**
 * Initializes all header components on DOMContentLoaded.
 * Registers custom elements and sets up controllers with null checks.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Define custom elements if not already defined
  if (!customElements.get('sticky-header')) {
    customElements.define('sticky-header', StickyHeader);
  }

  if (!customElements.get('mobile-drawer')) {
    customElements.define('mobile-drawer', MobileDrawer);
  }

  // Initialize MegaMenu
  const headerContainer = document.querySelector('.header__container');
  if (headerContainer) {
    window.__headerMegaMenu = new MegaMenu(headerContainer);
  }

  // Initialize MobileAccordion
  const drawerContent = document.querySelector('.mobile-drawer__content');
  if (drawerContent) {
    window.__headerAccordion = new MobileAccordion(drawerContent);
  }

  // Initialize SearchOverlay
  const searchOverlay = document.querySelector('.search-overlay');
  if (searchOverlay) {
    window.__headerSearch = new SearchOverlay(searchOverlay);
  }

  // Setup Shopify Editor event handlers
  setupEditorEvents();
});
