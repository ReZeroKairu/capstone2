// src/hooks/useFileDownloader.js
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "../firebase/firebase";

export const useFileDownloader = () => {
  const downloadFileCandidate = async (candidate, suggestedName) => {
    if (!candidate) return;
    try {
      let url;

      if (typeof candidate === "string" && /^https?:\/\//.test(candidate)) {
        url = candidate;
      } else if (typeof candidate === "object" && candidate.url) {
        url = candidate.url;
      } else {
        const path =
          typeof candidate === "string"
            ? candidate
            : candidate.path || candidate.storagePath || candidate.filePath;
        if (!path) return;
        url = await getDownloadURL(storageRef(storage, path));
      }

      if (/^https?:\/\//.test(url)) {
        const tempLink = document.createElement("a");
        tempLink.href = url;
        tempLink.download = suggestedName || url.split("/").pop();
        tempLink.target = "_blank";
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        return;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch file");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = suggestedName || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Unable to download file. Please try again.");
    }
  };

  return { downloadFileCandidate };
};
