// src/utils/quillConfig.js
import Quill from "quill";
import "../styles/quill-custom.css";

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

  sizePicker.querySelectorAll(".ql-picker-item").forEach((item) => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = item.getAttribute("data-value");
      const range = quill.getSelection(true);
      if (range && range.length > 0) {
        quill.formatText(range.index, range.length, "size", value);
      }
    });
  });
};

// ✅ standard Quill toolbar + formats
export const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [
      { 
        font: [
          "poppins", 
          "roboto",
          "serif", 
          "monospace", 
          "sans-serif"
        ] 
      },
      { size: ["small", "normal", "large", "huge"] },
    ],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["blockquote", "code-block"],
    ["link", "image"],
    ["clean"],
  ],
};

export const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "font",
  "size",
  "list",
  "bullet",
  "align",
  "blockquote",
  "code-block",
  "link",
  "image",
];
