import { HfInference } from '@huggingface/inference';

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateImage = async (prompt: string, hfToken?: string): Promise<string> => {
  // 1. Try Pollinations AI (100% Free, Unlimited FLUX model, No API key required)
  try {
    console.log('Generating image via Pollinations AI (FLUX)...');
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to generate image from Pollinations.');
    }
    const blob = await response.blob();
    console.log('Successfully generated image via Pollinations AI!');
    return URL.createObjectURL(blob);
  } catch (err: any) {
    console.warn('Pollinations AI failed, trying Hugging Face fallback...', err);
  }

  // 2. Hugging Face Fallback
  if (!hfToken) {
    throw new Error('Hugging Face API token is required for fallback. Please set it in the settings panel.');
  }

  const hf = new HfInference(hfToken);
  const models = [
    'black-forest-labs/FLUX.1-schnell',
    'stabilityai/stable-diffusion-3.5-medium',
    'stabilityai/stable-diffusion-xl-base-1.0',
    'stabilityai/stable-diffusion-2-1',
    'runwayml/stable-diffusion-v1-5'
  ];

  let lastError = '';

  for (const modelId of models) {
    try {
      console.log(`Attempting image generation with model: ${modelId}`);
      const blob = await hf.textToImage({
        model: modelId,
        inputs: prompt,
      });
      console.log(`Successfully generated image using model: ${modelId}`);
      return URL.createObjectURL(blob as any);
    } catch (err: any) {
      lastError = err.message || err;
      console.warn(`Model ${modelId} failed: ${lastError}. Trying fallback...`);
    }
  }

  throw new Error(`Text-to-Image Generation failed: ${lastError}`);
};

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const runwareInpainting = async (
  imageBlob: Blob,
  maskBlob: Blob,
  prompt: string,
  apiKey: string
): Promise<string> => {
  console.log('Initiating Runware inpainting workflow...');
  const imageBase64 = await blobToBase64(imageBlob);
  const maskBase64 = await blobToBase64(maskBlob);

  const imgTaskUUID = generateUUID();
  const maskTaskUUID = generateUUID();

  // Step 1: Upload both original image and mask
  const uploadPayload = [
    {
      taskType: 'imageUpload',
      taskUUID: imgTaskUUID,
      image: imageBase64,
    },
    {
      taskType: 'imageUpload',
      taskUUID: maskTaskUUID,
      image: maskBase64,
    },
  ];

  console.log('Uploading images to Runware...');
  const uploadRes = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(uploadPayload),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Runware Upload API error: ${uploadRes.statusText || errText}`);
  }

  const uploadData = await uploadRes.json();
  if (uploadData.errors && uploadData.errors.length > 0) {
    throw new Error(`Runware Upload error: ${uploadData.errors[0].message}`);
  }

  const results = uploadData.data || [];
  const imgResult = results.find((r: any) => r.taskUUID === imgTaskUUID);
  const maskResult = results.find((r: any) => r.taskUUID === maskTaskUUID);

  if (!imgResult || !imgResult.imageUUID) {
    throw new Error('Failed to retrieve image UUID from Runware upload response.');
  }
  if (!maskResult || !maskResult.imageUUID) {
    throw new Error('Failed to retrieve mask UUID from Runware upload response.');
  }

  const imageUUID = imgResult.imageUUID;
  const maskUUID = maskResult.imageUUID;
  console.log(`Images uploaded successfully. Image UUID: ${imageUUID}, Mask UUID: ${maskUUID}`);

  // Step 2: Request Image Inference (Inpainting) using FLUX.1 Fill
  const inferenceTaskUUID = generateUUID();
  const inferencePayload = [
    {
      taskType: 'imageInference',
      taskUUID: inferenceTaskUUID,
      positivePrompt: prompt,
      seedImage: imageUUID,
      maskImage: maskUUID,
      model: 'runware:102@1', // FLUX.1 Fill
      width: 1024,
      height: 1024,
      numberResults: 1,
    },
  ];

  console.log('Running FLUX Fill inference on Runware...');
  const inferenceRes = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(inferencePayload),
  });

  if (!inferenceRes.ok) {
    const errText = await inferenceRes.text();
    throw new Error(`Runware Inference API error: ${inferenceRes.statusText || errText}`);
  }

  const inferenceData = await inferenceRes.json();
  if (inferenceData.errors && inferenceData.errors.length > 0) {
    throw new Error(`Runware Inference error: ${inferenceData.errors[0].message}`);
  }

  const inferenceResults = inferenceData.data || [];
  const inpaintResult = inferenceResults.find((r: any) => r.taskUUID === inferenceTaskUUID);

  if (!inpaintResult || !inpaintResult.imageURL) {
    throw new Error('Runware inference response did not return an image URL.');
  }

  console.log('Runware inpainting complete! Fetching image...');
  const imageRes = await fetch(inpaintResult.imageURL);
  const resBlob = await imageRes.blob();
  return URL.createObjectURL(resBlob);
};

export const eraseObject = async (
  imageBlob: Blob,
  maskBlob: Blob,
  _hfToken: string,
  falKey?: string,
  runwareKey?: string,
  inpaintingProvider: 'fal' | 'runware' = 'fal'
): Promise<string> => {
  if (inpaintingProvider === 'runware') {
    if (!runwareKey) {
      throw new Error('Runware API Key is required for Pixel Eraser. Please click the Settings gear icon in the top-right corner to configure it.');
    }
    return runwareInpainting(
      imageBlob,
      maskBlob,
      'seamlessly erase the masked object, fill with background, highly detailed, realistic, high quality',
      runwareKey
    );
  }

  if (!falKey) {
    throw new Error('Fal.ai API Key is required for Pixel Eraser. Please click the Settings gear icon in the top-right corner to configure it.');
  }

  try {
    console.log('Using Fal.ai directly for inpainting...');
    const imageBase64 = await blobToBase64(imageBlob);
    const maskBase64 = await blobToBase64(maskBlob);

    const response = await fetch('https://fal.run/fal-ai/fast-sdxl/inpainting', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'seamlessly erase the masked object, fill with background, highly detailed, realistic, high quality',
        image_url: imageBase64,
        mask_url: maskBase64
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fal.ai API error: ${response.statusText || errText}`);
    }

    const data = await response.json();
    if (!data.image || !data.image.url) {
      throw new Error('Fal.ai returned an invalid image structure.');
    }

    console.log('Successfully completed inpainting via Fal.ai!');
    const imageRes = await fetch(data.image.url);
    const resBlob = await imageRes.blob();
    return URL.createObjectURL(resBlob);
  } catch (err: any) {
    console.error('Inpainting error:', err);
    throw new Error(`Inpainting failed: ${err.message || err}`);
  }
};

export const expandImage = async (
  imageBlob: Blob,
  maskBlob: Blob,
  prompt: string,
  _hfToken: string,
  falKey?: string,
  runwareKey?: string,
  inpaintingProvider: 'fal' | 'runware' = 'fal'
): Promise<string> => {
  if (inpaintingProvider === 'runware') {
    if (!runwareKey) {
      throw new Error('Runware API Key is required for Magic Expand. Please click the Settings gear icon in the top-right corner to configure it.');
    }
    return runwareInpainting(
      imageBlob,
      maskBlob,
      prompt || 'seamlessly fill the expanded borders to match the image, continuous background',
      runwareKey
    );
  }

  if (!falKey) {
    throw new Error('Fal.ai API Key is required for Magic Expand. Please click the Settings gear icon in the top-right corner to configure it.');
  }

  try {
    console.log('Using Fal.ai directly for outpainting...');
    const imageBase64 = await blobToBase64(imageBlob);
    const maskBase64 = await blobToBase64(maskBlob);

    const response = await fetch('https://fal.run/fal-ai/fast-sdxl/inpainting', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt || 'seamlessly fill the expanded borders to match the image, continuous background',
        image_url: imageBase64,
        mask_url: maskBase64
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fal.ai API error: ${response.statusText || errText}`);
    }

    const data = await response.json();
    if (!data.image || !data.image.url) {
      throw new Error('Fal.ai returned an invalid image structure.');
    }

    console.log('Successfully completed outpainting via Fal.ai!');
    const imageRes = await fetch(data.image.url);
    const resBlob = await imageRes.blob();
    return URL.createObjectURL(resBlob);
  } catch (err: any) {
    console.error('Outpainting error:', err);
    throw new Error(`Outpainting failed: ${err.message || err}`);
  }
};

export const generateText = async (
  prompt: string,
  systemPrompt: string,
  groqKey: string
): Promise<string> => {
  if (!groqKey) {
    throw new Error('Groq API Key is required. Please set it in the settings panel.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.statusText || errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
};

class HeapQueue<T> {
  cmp: (a: T, b: T) => number;
  length: number;
  data: T[];

  constructor(cmp?: (a: T, b: T) => number) {
    this.cmp = cmp || ((a: any, b: any) => a - b);
    this.length = 0;
    this.data = [];
  }

  peek(): T | undefined {
    return this.data[0];
  }

  push(value: T): number {
    this.data.push(value);
    let pos = this.data.length - 1;
    while (pos > 0) {
      const parent = (pos - 1) >>> 1;
      if (this.cmp(this.data[pos], this.data[parent]) < 0) {
        const x = this.data[parent];
        this.data[parent] = this.data[pos];
        this.data[pos] = x;
        pos = parent;
      } else {
        break;
      }
    }
    return ++this.length;
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const ret = this.data[0];
    const lastVal = this.data.pop()!;
    this.length--;
    if (this.data.length > 0) {
      this.data[0] = lastVal;
      let pos = 0;
      const last = this.data.length - 1;
      while (true) {
        const left = (pos << 1) + 1;
        const right = left + 1;
        let minIndex = pos;
        if (left <= last && this.cmp(this.data[left], this.data[minIndex]) < 0) {
          minIndex = left;
        }
        if (right <= last && this.cmp(this.data[right], this.data[minIndex]) < 0) {
          minIndex = right;
        }
        if (minIndex !== pos) {
          const x = this.data[minIndex];
          this.data[minIndex] = this.data[pos];
          this.data[pos] = x;
          pos = minIndex;
        } else {
          break;
        }
      }
    }
    return ret;
  }
}

function InpaintTelea(
  width: number,
  height: number,
  image: Float32Array,
  mask: Uint8Array,
  radius: number = 5
): Float32Array {
  const LARGE_VALUE = 1e6;
  const SMALL_VALUE = 1e-6;

  const size = width * height;
  const flag = new Uint8Array(size);
  const u = new Float32Array(size);

  for (let i = 0; i < size; i++) {
    if (!mask[i]) continue;
    flag[i] = 1;
    if (i + 1 < size) flag[i + 1] = 1;
    if (i - 1 >= 0) flag[i - 1] = 1;
    if (i + width < size) flag[i + width] = 1;
    if (i - width >= 0) flag[i - width] = 1;
  }

  for (let i = 0; i < size; i++) {
    flag[i] = flag[i] * 2 - (mask[i] ^ flag[i]);
    if (flag[i] === 2) {
      u[i] = LARGE_VALUE;
    }
  }

  const heap = new HeapQueue<[number, number]>((a, b) => a[0] - b[0]);

  for (let i = 0; i < size; i++) {
    if (flag[i] === 1) {
      heap.push([u[i], i]);
    }
  }

  const indicesCentered: number[] = [];
  for (let i = -radius; i <= radius; i++) {
    const h = Math.floor(Math.sqrt(radius * radius - i * i));
    for (let j = -h; j <= h; j++) {
      indicesCentered.push(i + j * width);
    }
  }

  function eikonal(n1: number, n2: number): number {
    let uOut = LARGE_VALUE;
    const u1 = u[n1];
    const u2 = u[n2];
    if (flag[n1] === 0) {
      if (flag[n2] === 0) {
        const perp = Math.sqrt(2 - (u1 - u2) * (u1 - u2));
        let s = (u1 + u2 - perp) * 0.5;
        if (s >= u1 && s >= u2) {
          uOut = s;
        } else {
          s += perp;
          if (s >= u1 && s >= u2) {
            uOut = s;
          }
        }
      } else {
        uOut = 1 + u1;
      }
    } else if (flag[n2] === 0) {
      uOut = 1 + u2;
    }
    return uOut;
  }

  function gradFunc(array: Float32Array, n: number, step: number): number {
    if (flag[n + step] !== 2) {
      if (flag[n - step] !== 2) {
        return (array[n + step] - array[n - step]) * 0.5;
      } else {
        return array[n + step] - array[n];
      }
    } else {
      if (flag[n - step] !== 2) {
        return array[n] - array[n - step];
      } else {
        return 0;
      }
    }
  }

  function inpaintPoint(n: number) {
    let Ia = 0;
    let norm = 0;
    const gradx_u = gradFunc(u, n, 1);
    const grady_u = gradFunc(u, n, width);

    const i = n % width;
    const j = Math.floor(n / width);

    for (let k = 0; k < indicesCentered.length; k++) {
      const nb = n + indicesCentered[k];
      const i_nb = nb % width;
      const j_nb = Math.floor(nb / width);

      if (i_nb <= 1 || j_nb <= 1 || i_nb >= width - 1 || j_nb >= height - 1) continue;
      if (flag[nb] !== 0) continue;

      const rx = i - i_nb;
      const ry = j - j_nb;

      const geometricDst = 1 / ((rx * rx + ry * ry) * Math.sqrt(rx * rx + ry * ry));
      const levelsetDst = 1 / (1 + Math.abs(u[nb] - u[n]));
      const direction = Math.abs(rx * gradx_u + ry * grady_u);
      const weight = geometricDst * levelsetDst * direction + SMALL_VALUE;

      Ia += weight * image[nb];
      norm += weight;
    }
    image[n] = Ia / norm;
  }

  while (heap.length > 0) {
    const popped = heap.pop();
    if (!popped) break;
    const n = popped[1];
    const i = n % width;
    const j = Math.floor(n / width);
    flag[n] = 0; // KNOWN
    if (i <= 1 || j <= 1 || i >= width - 1 || j >= height - 1) continue;
    for (let k = 0; k < 4; k++) {
      const nb = n + [-width, -1, width, 1][k];
      if (flag[nb] !== 0) {
        u[nb] = Math.min(
          eikonal(nb - width, nb - 1),
          eikonal(nb + width, nb - 1),
          eikonal(nb - width, nb + 1),
          eikonal(nb + width, nb + 1)
        );
        if (flag[nb] === 2) {
          flag[nb] = 1; // BAND
          heap.push([u[nb], nb]);
          inpaintPoint(nb);
        }
      }
    }
  }
  return image;
}

const blobToImage = (blob: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
};

export const localInpaint = async (imageBlob: Blob, maskBlob: Blob): Promise<string> => {
  console.log('Starting client-side local image inpainting fallback...');
  const img = await blobToImage(imageBlob);
  const maskImg = await blobToImage(maskBlob);

  const MAX_DIM = 512;
  let width = img.width;
  let height = img.height;
  
  if (width > MAX_DIM || height > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const imgCanvas = document.createElement('canvas');
  imgCanvas.width = width;
  imgCanvas.height = height;
  const imgCtx = imgCanvas.getContext('2d')!;
  imgCtx.drawImage(img, 0, 0, width, height);
  const imgData = imgCtx.getImageData(0, 0, width, height);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d')!;
  maskCtx.drawImage(maskImg, 0, 0, width, height);
  const maskData = maskCtx.getImageData(0, 0, width, height);

  const size = width * height;
  const maskArr = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const r = maskData.data[i * 4];
    const g = maskData.data[i * 4 + 1];
    const b = maskData.data[i * 4 + 2];
    const a = maskData.data[i * 4 + 3];
    maskArr[i] = (r > 100 || g > 100 || b > 100) && a > 50 ? 1 : 0;
  }

  const rArr = new Float32Array(size);
  const gArr = new Float32Array(size);
  const bArr = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    rArr[i] = imgData.data[i * 4];
    gArr[i] = imgData.data[i * 4 + 1];
    bArr[i] = imgData.data[i * 4 + 2];
  }

  InpaintTelea(width, height, rArr, maskArr, 6);
  InpaintTelea(width, height, gArr, maskArr, 6);
  InpaintTelea(width, height, bArr, maskArr, 6);

  for (let i = 0; i < size; i++) {
    imgData.data[i * 4] = Math.min(255, Math.max(0, rArr[i]));
    imgData.data[i * 4 + 1] = Math.min(255, Math.max(0, gArr[i]));
    imgData.data[i * 4 + 2] = Math.min(255, Math.max(0, bArr[i]));
    imgData.data[i * 4 + 3] = 255;
  }

  imgCtx.putImageData(imgData, 0, 0);

  return new Promise<string>((resolve) => {
    imgCanvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob!));
    }, 'image/png');
  });
};

export const photoroomEdit = async (
  imageBlob: Blob,
  mode: 'text-removal' | 'object-removal',
  prompt: string,
  apiKey: string
): Promise<string> => {
  console.log(`Initiating Photoroom Edit API. Mode: ${mode}, Prompt: ${prompt}`);
  const formData = new FormData();
  formData.append('imageFile', imageBlob, 'image.png');
  formData.append('removeBackground', 'false');

  if (mode === 'text-removal') {
    formData.append('textRemoval.mode', 'ai.all');
  } else {
    formData.append('editWithAI.mode', 'ai.auto');
    formData.append('editWithAI.prompt', prompt);
  }

  const response = await fetch('https://image-api.photoroom.com/v2/edit', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Photoroom API error: ${response.statusText || errorText}`);
  }

  const resultBlob = await response.blob();
  return URL.createObjectURL(resultBlob);
};
