import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "";

function formatTimestamp(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

const speechSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

export default function ViewerPage() {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("loading"); // loading | ready | error | empty
  const [isDeleting, setIsDeleting] = useState(false);
  const [speakingField, setSpeakingField] = useState(null); // "extracted" | "translation" | null

  useEffect(() => {
    fetch(`${API_URL}/api/items`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setItems(data);
        setStatus(data.length ? "ready" : "empty");
      })
      .catch((err) => {
        console.error(err);
        setStatus("error");
      });
  }, []);

  const current = items[index];

  // Stop any in-progress speech whenever we move to a different item
  useEffect(() => {
    if (speechSupported) window.speechSynthesis.cancel();
    setSpeakingField(null);
  }, [index]);

  // Stop speech if the component unmounts mid-utterance
  useEffect(() => {
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = (text, field, lang) => {
    if (!speechSupported || !text) return;

    // If this field is already speaking, treat the click as "stop"
    if (speakingField === field) {
      window.speechSynthesis.cancel();
      setSpeakingField(null);
      return;
    }

    window.speechSynthesis.cancel(); // stop anything else that's playing
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => setSpeakingField(null);
    utterance.onerror = () => setSpeakingField(null);
    setSpeakingField(field);
    window.speechSynthesis.speak(utterance);
  };

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(items.length - 1, i + 1));

  const handleDelete = async () => {
    // Identify the blob using current.id, current.name, or current.blobName
    const blobIdentifier = current.id || current.name || current.blobName;

    if (!blobIdentifier) {
      alert("Unable to delete: Missing item identifier.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this item from Azure Blob Storage?")) {
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch(`${API_URL}/api/items/${encodeURIComponent(blobIdentifier)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(`Failed to delete item: ${res.status}`);

      // Filter out deleted item from state
      const updatedItems = items.filter((_, i) => i !== index);
      setItems(updatedItems);

      if (updatedItems.length === 0) {
        setStatus("empty");
      } else {
        // Adjust current index safely if at the end of array
        setIndex((i) => (i >= updatedItems.length ? updatedItems.length - 1 : i));
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting the file.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main>
      {status === "loading" && (
        <p className="status-message">Loading translations…</p>
      )}

      {status === "error" && (
        <p className="status-message error">
          Couldn't reach the server. Is the API running?
        </p>
      )}

      {status === "empty" && (
        <p className="status-message">No items found in the container yet.</p>
      )}

      {status === "ready" && current && (
        <>
          <section className="viewer-container">
            <button
              className="nav-arrow prev"
              aria-label="Previous image"
              onClick={goPrev}
              disabled={index === 0 || isDeleting}
            >
              &#10094;
            </button>

            <div className="image-wrapper">
              {current.image ? (
                <img
                  src={`data:image/png;base64,${current.image}`}
                  alt={current.extracted_text || "translated image"}
                />
              ) : (
                <div className="image-placeholder">
                  <p>[ Image Preview ]</p>
                </div>
              )}
            </div>

            <button
              className="nav-arrow next"
              aria-label="Next image"
              onClick={goNext}
              disabled={index === items.length - 1 || isDeleting}
            >
              &#10095;
            </button>
          </section>

          <div className="meta-row">
            <span>
              {index + 1} of {items.length}
            </span>
            <button 
              className="delete-button" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete Item"}
            </button>
            <span>{formatTimestamp(current.timestamp_utc)}</span>
          </div>

          <section className="text-panel">
            <div className="text-box">
              <div className="text-box-header">
                <h3>Extracted Text</h3>
                {speechSupported && current.extracted_text && (
                  <button
                    className="listen-button"
                    onClick={() =>
                      speak(current.extracted_text, "extracted", "en-US")
                    }
                  >
                    {speakingField === "extracted" ? "⏹ Stop" : "🔊 Listen"}
                  </button>
                )}
              </div>
              <p>{current.extracted_text}</p>
            </div>

            <div className="text-box">
              <div className="text-box-header">
                <h3>Spanish Translation</h3>
                {speechSupported && current.translation_to_spanish && (
                  <button
                    className="listen-button"
                    onClick={() =>
                      speak(
                        current.translation_to_spanish,
                        "translation",
                        "es-ES"
                      )
                    }
                  >
                    {speakingField === "translation" ? "⏹ Stop" : "🔊 Listen"}
                  </button>
                )}
              </div>
              <p>{current.translation_to_spanish}</p>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
