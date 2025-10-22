// src/pages/PeerReviewer/helpers/fileHelpers.js
import { storage } from "../../../firebase/firebase";
import { ref as storageRef, getDownloadURL } from "firebase/storage";

/**
 * Build a REST GET URL for a storage path (fallback if getDownloadURL fails).
 */
export const buildRestUrlSafe = (rawPath) => {
  if (!rawPath) return null;
  const path = rawPath
    .toString()
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
  const bucket =
    storage?.app?.options?.storageBucket || "pubtrack2.firebasestorage.app";
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
    path
  )}?alt=media`;
};

/**
 * Try to resolve path through firebase storage, falling back to REST URL.
 * Returns resolved URL or null.
 */
export const resolveStoragePathToUrl = async (path) => {
  if (!path) return null;
  try {
    // if it's already a URL
    if (typeof path === "string" && path.startsWith("http")) return path;

    // if passed an object with url/fileUrl
    if (path.url || path.fileUrl) return path.url || path.fileUrl;

    return await getDownloadURL(storageRef(storage, path));
  } catch (err) {
    // Fallback
    return buildRestUrlSafe(path);
  }
};

/**
 * Safe file download utility that creates an anchor and clicks it.
 */
export const downloadFileCandidate = (fileUrl, fileName = "file") => {
  if (!fileUrl) return;

  const link = document.createElement("a");
  link.href = fileUrl;
  // try to force download file name
  try {
    link.download = fileName;
  } catch (e) {
    // some browsers ignore download for cross-origin; still set target
  }
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
