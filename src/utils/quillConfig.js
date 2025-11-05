// src/utils/quillConfig.js
import Quill from "quill";
import "../styles/quill-custom.css";

// 1. Add Touch Module for better touch handling
class TouchModule {
  constructor(quill) {
    this.quill = quill;
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.init();
  }

  init() {
    // Use passive event listeners for better performance
    this.quill.root.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.quill.root.addEventListener('touchmove', this.handleTouchMove, { passive: true });
  }

  handleTouchStart() {
    // Touch start handler
  }

  handleTouchMove() {
    // Touch move handler
  }
}

// Register the touch module
Quill.register('modules/touch', TouchModule);

// Register custom fonts
const Font = Quill.import('formats/font');
Font.whitelist = ['poppins', 'roboto', 'serif', 'monospace', 'sans-serif'];
Quill.register(Font, true);

// Register size format
const Size = Quill.import("formats/size");
Size.whitelist = ["small", "normal", "large", "huge"];
Quill.register(Size, true);

// Register custom font styles
const FontStyle = Quill.import('attributors/class/font');
FontStyle.whitelist = ['poppins', 'roboto', 'serif', 'monospace', 'sans-serif'];
Quill.register(FontStyle, true);

// optional: reference map if you style these classes yourself
export const fontSizeConfig = {
  small: "0.75rem",
  normal: "1rem",
  large: "1.5rem",
  huge: "2.5rem",
};

// ✅ no subclassing, just adjust the picker UI if you want labels
export const customToolbar = (quill) => {
  const toolbar = quill.getModule("toolbar");
  if (!toolbar) return;

  const sizePicker = toolbar.container.querySelector(".ql-size");
  if (!sizePicker) return;

  sizePicker.innerHTML = `
    <span class="ql-picker-label" data-value="">Size</span>
    <span class="ql-picker-options">
      <span class="ql-picker-item" data-value="small">Small</span>
      <span class="ql-picker-item" data-value="normal">Normal</span>
      <span class="ql-picker-item" data-value="large">Large</span>
      <span class="ql-picker-item" data-value="huge">Huge</span>
    </span>
  `;

  // Use passive event listeners for better performance
  const options = { passive: true };
  
  sizePicker.querySelectorAll(".ql-picker-item").forEach((item) => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = item.getAttribute("data-value");
      const range = quill.getSelection(true);
      if (range && range.length > 0) {
        quill.formatText(range.index, range.length, "size", value);
      }
    }, options);
  });
};

// ✅ standard Quill toolbar + formats
// Default modules configuration
export const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'font': ['poppins', 'roboto', 'serif', 'monospace', 'sans-serif'] }],
    [{ 'size': ['small', 'normal', 'large', 'huge'] }],
    ['link', 'image'],
    ['clean']
  ],
  touch: true, // Enable touch module
  clipboard: {
    matchVisual: false
  }
};

// Function to apply passive event listeners to all Quill instances
export const applyPassiveEventListeners = () => {
  if (typeof window === 'undefined') return;

  const options = {
    passive: true,
    capture: true
  };

  // Apply to all existing Quill editors
  document.querySelectorAll('.ql-editor').forEach(editor => {
    const events = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
    events.forEach(event => {
      // Only add the listener if it doesn't exist yet
      if (!editor[`__${event}_listener_added`]) {
        editor.addEventListener(event, () => {}, options);
        editor[`__${event}_listener_added`] = true;
      }
    });
  });
};

// Apply passive listeners when the DOM is loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'complete') {
    applyPassiveEventListeners();
  } else {
    window.addEventListener('load', applyPassiveEventListeners);
  }
}

// Allowed formats for Quill
export const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet',
  'color', 'background',
  'font', 'size',
  'link', 'image'
];