import * as faceapi from '@vladmandic/face-api';
import jpeg from 'jpeg-js';

let modelsLoaded = false;

export class ServerBiometricService {
  static async loadModels() {
    if (modelsLoaded) return;

    const modelUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl)
    ]);
    modelsLoaded = true;
  }

  static async extractRealFaceVector(imageBase64) {
    if (!modelsLoaded) await this.loadModels();
    
    let tensor;
    try {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const rawImageData = jpeg.decode(buffer, { useTArray: true });
      
      const numChannels = 3;
      const numPixels = rawImageData.width * rawImageData.height;
      const values = new Int32Array(numPixels * numChannels);
      
      for (let i = 0; i < numPixels; i++) {
        for (let c = 0; c < numChannels; c++) {
          values[i * numChannels + c] = rawImageData.data[i * 4 + c];
        }
      }
      
      tensor = faceapi.tf.tensor3d(values, [rawImageData.height, rawImageData.width, numChannels], 'int32');
      
      const detection = await faceapi.detectSingleFace(
        tensor, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (!detection) return null;
      return Array.from(detection.descriptor);
    } catch (err) {
      console.error("AI Face Extraction Error:", err);
      return null;
    } finally {
      if (tensor) {
        tensor.dispose();
      }
    }
  }
}
