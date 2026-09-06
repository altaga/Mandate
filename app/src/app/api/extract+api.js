import { ServerBiometricService } from '../../services/serverBiometricService.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      throw new Error("Missing imageBase64");
    }

    const faceVector = await ServerBiometricService.extractRealFaceVector(imageBase64);
    
    if (!faceVector) {
      throw new Error("No face detected by AI model. Ensure good lighting.");
    }

    return Response.json({ success: true, faceVector });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
