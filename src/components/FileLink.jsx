import React, { useState, useEffect } from "react";
import { storage } from "../firebase/firebase";
import { ref, getDownloadURL } from "firebase/storage";

export function FileLink({ file }) {
  const [url, setUrl] = useState(file?.url || null);
  const [loading, setLoading] = useState(!url);

  useEffect(() => {
    let mounted = true;

    if (!file) {
      setLoading(false);
      return;
    }

    const fetchUrl = async () => {
      try {
        if (file.url) {
          if (mounted) {
            setUrl(file.url);
            setLoading(false);
          }
          return;
        }

        const filePath = file.path || file.storagePath;
        if (!filePath) throw new Error("No file path available");

        const fileRef = ref(storage, filePath);
        const downloadUrl = await getDownloadURL(fileRef);
        if (mounted) setUrl(downloadUrl);
      } catch (err) {
        console.error("Error fetching file URL:", err, file);
        if (mounted) setUrl(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUrl();

    return () => {
      mounted = false;
    };
  }, [file]);

  if (loading)
    return <span className="text-gray-500 italic mr-2">Loading...</span>;

  if (!url)
    return (
      <span className="text-gray-400 italic mr-2">
        {file?.name || "File"} (Unavailable)
      </span>
    );

  const extension = file?.name?.split(".").pop()?.toLowerCase();

  if (["jpg", "jpeg", "png", "gif"].includes(extension)) {
    return <img src={url} alt={file.name} className="max-w-full max-h-48 rounded-md mb-2" />;
  }

  if (extension === "pdf") {
    return (
      <iframe
        src={url}
        title={file.name}
        className="w-full h-64 border rounded-md mb-2"
      />
    );
  }

  if (["mp4", "webm", "ogg"].includes(extension)) {
    return (
      <video controls className="max-w-full max-h-48 rounded-md mb-2">
        <source src={url} type={`video/${extension}`} />
        Your browser does not support the video tag.
      </video>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline mr-2"
    >
      {file.name || "File"}
    </a>
  );
}
