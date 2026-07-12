"use client";

import { useState } from "react";
import SignOutButton from "./SignOutButton";

async function requestGeneration(stage, image) {
  const data = new FormData();
  data.set("stage", stage);
  data.set("image", image, image.name || `${stage}.png`);
  const response = await fetch("/api/generate", { method: "POST", body: data });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Generation failed.");
  return result.imageUrl;
}

async function requestVideo(image) {
  const data = new FormData();
  data.set("image", image, "scene.png");
  const response = await fetch("/api/generate-video", { method: "POST", body: data });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Video generation failed.");
  return result;
}

export default function Home() {
  const [sourceFile, setSourceFile] = useState(null);
  const [sourcePreview, setSourcePreview] = useState(null);
  const [uploadStep, setUploadStep] = useState({ cls: "active", status: "Ready" });
  const [mascotStep, setMascotStep] = useState({ cls: "locked", status: "Waiting" });
  const [sceneStep, setSceneStep] = useState({ cls: "locked", status: "Waiting" });
  const [videoStep, setVideoStep] = useState({ cls: "locked", status: "Waiting" });
  const [mascotUrl, setMascotUrl] = useState(null);
  const [sceneUrl, setSceneUrl] = useState(null);
  const [videoDownloadUrl, setVideoDownloadUrl] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [mascotBusy, setMascotBusy] = useState(false);
  const [sceneBusy, setSceneBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    setSourceFile(file);
    setSourcePreview(URL.createObjectURL(file));
  }

  async function handleCreateMascot() {
    setError("");
    setMascotBusy(true);
    setUploadStep({ cls: "active", status: "Generating" });
    try {
      const url = await requestGeneration("mascot", sourceFile);
      setMascotUrl(url);
      setUploadStep({ cls: "complete", status: "Complete" });
      setMascotStep({ cls: "active", status: "Ready" });
    } catch (err) {
      setUploadStep({ cls: "active", status: "Try again" });
      setError(err.message);
    } finally {
      setMascotBusy(false);
    }
  }

  async function handleCreateScene() {
    setError("");
    setSceneBusy(true);
    setMascotStep((step) => ({ ...step, status: "Generating" }));
    try {
      const blob = await fetch(mascotUrl).then((response) => response.blob());
      const file = new File([blob], "base-mascot.png", { type: "image/png" });
      const url = await requestGeneration("sitting", file);
      setSceneUrl(url);
      setMascotStep({ cls: "complete", status: "Complete" });
      setSceneStep({ cls: "complete", status: "Complete" });
      setVideoStep({ cls: "active", status: "Ready" });
    } catch (err) {
      setMascotStep({ cls: "active", status: "Try again" });
      setError(err.message);
    } finally {
      setSceneBusy(false);
    }
  }

  async function handleCreateVideo() {
    setError("");
    setVideoBusy(true);
    setVideoStep((step) => ({ ...step, status: "Generating" }));
    try {
      const blob = await fetch(sceneUrl).then((response) => response.blob());
      const file = new File([blob], "scene.png", { type: "image/png" });
      const { videoUrl, previewUrl } = await requestVideo(file);
      setVideoDownloadUrl(videoUrl);
      setVideoPreviewUrl(previewUrl);
      setVideoStep({ cls: "complete", status: "Complete" });
    } catch (err) {
      setVideoStep({ cls: "active", status: "Try again" });
      setError(err.message);
    } finally {
      setVideoBusy(false);
    }
  }

  return (
    <main>
      <nav>
        <span className="mark">M</span>
        <strong>Morphling Studio</strong>
        <span className="pill">Image pipeline</span>
        <SignOutButton />
      </nav>
      <header>
        <p className="eyebrow">FROM PORTRAIT TO CHARACTER</p>
        <h1>
          Create your mascot,
          <br />
          <em>one moment at a time.</em>
        </h1>
        <p className="intro">
          Upload one photo. We&rsquo;ll shape the character, preserve its identity, then place it into a
          production-ready scene.
        </p>
      </header>

      <section className="timeline">
        <article className={`step ${uploadStep.cls}`} data-step="upload">
          <div className="rail">
            <span>01</span>
          </div>
          <div className="content">
            <div className="step-title">
              <div>
                <small>REFERENCE</small>
                <h2>Choose a portrait</h2>
              </div>
              <b className="status">{uploadStep.status}</b>
            </div>
            <label className="drop" htmlFor="file">
              <input id="file" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
              {sourcePreview ? (
                <img id="sourcePreview" src={sourcePreview} alt="Your uploaded portrait" />
              ) : (
                <span className="upload-copy">
                  <b>Drop your photo here</b>
                  <small>or click to browse · PNG, JPG or WebP · max 20 MB</small>
                </span>
              )}
            </label>
            <button id="createMascot" disabled={!sourceFile || mascotBusy} onClick={handleCreateMascot}>
              {mascotBusy ? (
                <>
                  <span className="spinner" /> Creating identity…
                </>
              ) : (
                <>
                  Create mascot <span>→</span>
                </>
              )}
            </button>
          </div>
        </article>

        <article className={`step ${mascotStep.cls}`} data-step="mascot">
          <div className="rail">
            <span>02</span>
          </div>
          <div className="content">
            <div className="step-title">
              <div>
                <small>IDENTITY</small>
                <h2>Your base mascot</h2>
              </div>
              <b className="status">{mascotStep.status}</b>
            </div>
            <div className={`result${mascotUrl ? "" : " empty"}`}>
              {mascotUrl ? (
                <img src={mascotUrl} alt="Generated base mascot" />
              ) : (
                <span>The generated mascot will appear here.</span>
              )}
            </div>
            <button id="createScene" disabled={!mascotUrl || sceneBusy} onClick={handleCreateScene}>
              {sceneBusy ? (
                <>
                  <span className="spinner" /> Building scene…
                </>
              ) : (
                <>
                  Create sitting scene <span>→</span>
                </>
              )}
            </button>
          </div>
        </article>

        <article className={`step ${sceneStep.cls}`} data-step="scene">
          <div className="rail">
            <span>03</span>
          </div>
          <div className="content">
            <div className="step-title">
              <div>
                <small>SCENE</small>
                <h2>Ready for the timeline</h2>
              </div>
              <b className="status">{sceneStep.status}</b>
            </div>
            <div className={`result${sceneUrl ? "" : " empty"}`}>
              {sceneUrl ? (
                <img src={sceneUrl} alt="Mascot sitting at a desk" />
              ) : (
                <span>Your final sitting mascot will appear here.</span>
              )}
            </div>
            {sceneUrl && (
              <a className="button secondary" href={sceneUrl} download="morphling-sitting-mascot.png">
                Download final PNG <span>↓</span>
              </a>
            )}
          </div>
        </article>

        <article className={`step ${videoStep.cls}`} data-step="video">
          <div className="rail">
            <span>04</span>
          </div>
          <div className="content">
            <div className="step-title">
              <div>
                <small>MOTION</small>
                <h2>Animate the mascot</h2>
              </div>
              <b className="status">{videoStep.status}</b>
            </div>
            <div className={`result${videoPreviewUrl ? "" : " empty"}`}>
              {videoPreviewUrl ? (
                <video src={videoPreviewUrl} autoPlay loop muted playsInline />
              ) : (
                <span>Your animated mascot preview will appear here.</span>
              )}
            </div>
            <button id="createVideo" disabled={!sceneUrl || videoBusy} onClick={handleCreateVideo}>
              {videoBusy ? (
                <>
                  <span className="spinner" /> Animating…
                </>
              ) : (
                <>
                  Create video <span>→</span>
                </>
              )}
            </button>
            {videoDownloadUrl && (
              <a className="button secondary" href={videoDownloadUrl} download>
                Download transparent ProRes (.mov) <span>↓</span>
              </a>
            )}
          </div>
        </article>
      </section>
      <p className="error" role="alert">
        {error}
      </p>
    </main>
  );
}
