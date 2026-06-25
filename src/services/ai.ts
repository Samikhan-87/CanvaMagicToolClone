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

export const generateImage = async (prompt: string, hfToken: string): Promise<string> => {
  if (!hfToken) {
    throw new Error('Hugging Face API token is required. Please set it in the settings panel.');
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

export const eraseObject = async (
  imageBlob: Blob,
  maskBlob: Blob,
  _hfToken: string,
  falKey?: string
): Promise<string> => {
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
  falKey?: string
): Promise<string> => {
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
