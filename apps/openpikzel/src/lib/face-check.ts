// Persona photo check, in the browser: exactly one face, big enough to keep identity.
// MediaPipe Face Detector (Apache-2.0) loads on first use; nothing leaves the device.
export type FaceCheck = { ok: true; faceHeight: number; small: boolean } | { ok: false; reason: "no-face" | "many-faces" | "unavailable" };

let detector: Promise<{ detect: (img: HTMLImageElement | ImageBitmap) => { detections: { boundingBox?: { height: number } }[] } }> | null = null;
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

function load() {
  detector ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM);
    return FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL }, runningMode: "IMAGE", minDetectionConfidence: 0.6 });
  })();
  return detector;
}

/** Returns the face size in source pixels; `small` when the face is under 256 px tall. */
export async function checkFace(file: File): Promise<FaceCheck> {
  try {
    const [d, bitmap] = await Promise.all([load(), createImageBitmap(file)]);
    const faces = d.detect(bitmap).detections;
    bitmap.close();
    if (!faces.length) return { ok: false, reason: "no-face" };
    if (faces.length > 1) return { ok: false, reason: "many-faces" };
    const h = Math.round(faces[0].boundingBox?.height ?? 0);
    return { ok: true, faceHeight: h, small: h < 256 };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
