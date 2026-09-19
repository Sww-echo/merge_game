import { validateResources } from './resource-schema.js';

export async function loadResources(url = 'resources.json') {
  const candidates = ['/api/resources', url];
  let lastError;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return validateResources(await response.json());
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Unable to load resource configuration: ${lastError?.message || 'unknown error'}`);
}

export function resolveResourceUrl(path) {
  return new URL(path, document.baseURI).href;
}
