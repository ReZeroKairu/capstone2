// src/utils/quillConfig.js
import Quill from "quill";

// Define custom sizes to match your toolbar
const Size = Quill.import("formats/size");
Size.whitelist = ["small", false, "large", "huge"];
Quill.register(Size, true);

export const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [
      { font: ["serif", "monospace", "sans-serif"] },
      { size: ["small", false, "large", "huge"] }, // now huge works
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
