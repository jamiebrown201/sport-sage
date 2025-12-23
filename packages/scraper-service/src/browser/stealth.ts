/**
 * Stealth Mode - Additional fingerprint randomization
 *
 * Works alongside playwright-extra stealth plugin for defense in depth.
 */

import type { Page } from 'playwright';

export async function applyStealthMode(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // === BASIC STEALTH ===
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-GB', 'en-US', 'en'],
    });

    // Mock permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(parameters);

    // Mock chrome runtime
    (window as any).chrome = {
      runtime: {},
      loadTimes: () => ({}),
      csi: () => ({}),
    };

    // === CANVAS FINGERPRINT RANDOMIZATION ===
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (type?: string, quality?: any) {
      const ctx = this.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        // Add random noise to a few pixels
        for (let i = 0; i < data.length; i += 400) {
          data[i] = data[i] ^ (Math.random() > 0.5 ? 1 : 0);
        }
        ctx.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.call(this, type, quality);
    };

    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (
      sx: number,
      sy: number,
      sw: number,
      sh: number
    ) {
      const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
      for (let i = 0; i < imageData.data.length; i += 400) {
        imageData.data[i] = imageData.data[i] ^ (Math.random() > 0.5 ? 1 : 0);
      }
      return imageData;
    };

    // === WEBGL FINGERPRINT RANDOMIZATION ===
    const getParameterOriginal = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
      if (parameter === 37445) {
        // UNMASKED_VENDOR_WEBGL
        return 'Google Inc. (NVIDIA)';
      }
      if (parameter === 37446) {
        // UNMASKED_RENDERER_WEBGL
        const renderers = [
          'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (NVIDIA GeForce RTX 2070 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
        ];
        return renderers[Math.floor(Math.random() * renderers.length)];
      }
      return getParameterOriginal.call(this, parameter);
    };

    // WebGL2 support
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParameter2Original = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (parameter: number) {
        if (parameter === 37445) {
          return 'Google Inc. (NVIDIA)';
        }
        if (parameter === 37446) {
          const renderers = [
            'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
            'ANGLE (NVIDIA GeForce RTX 2070 Direct3D11 vs_5_0 ps_5_0)',
            'ANGLE (Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
          ];
          return renderers[Math.floor(Math.random() * renderers.length)];
        }
        return getParameter2Original.call(this, parameter);
      };
    }

    // === AUDIO FINGERPRINT RANDOMIZATION ===
    const audioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (audioContext) {
      const originalCreateAnalyser = audioContext.prototype.createAnalyser;
      audioContext.prototype.createAnalyser = function () {
        const analyser = originalCreateAnalyser.call(this);
        const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);
        analyser.getFloatFrequencyData = function (array: Float32Array<ArrayBuffer>) {
          originalGetFloatFrequencyData(array);
          for (let i = 0; i < array.length; i += 10) {
            array[i] = array[i] + (Math.random() * 0.0001 - 0.00005);
          }
        };
        return analyser;
      };
    }

    // === HARDWARE CONCURRENCY RANDOMIZATION ===
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => [4, 8, 12, 16][Math.floor(Math.random() * 4)],
    });

    // === DEVICE MEMORY RANDOMIZATION ===
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => [4, 8, 16, 32][Math.floor(Math.random() * 4)],
    });

    // === SCREEN PROPERTIES ===
    const screenProps = [
      { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24 },
      { width: 2560, height: 1440, availWidth: 2560, availHeight: 1400, colorDepth: 24 },
      { width: 1366, height: 768, availWidth: 1366, availHeight: 728, colorDepth: 24 },
      { width: 1536, height: 864, availWidth: 1536, availHeight: 824, colorDepth: 24 },
    ];
    const selectedScreen = screenProps[Math.floor(Math.random() * screenProps.length)];

    Object.defineProperty(screen, 'width', { get: () => selectedScreen.width });
    Object.defineProperty(screen, 'height', { get: () => selectedScreen.height });
    Object.defineProperty(screen, 'availWidth', { get: () => selectedScreen.availWidth });
    Object.defineProperty(screen, 'availHeight', { get: () => selectedScreen.availHeight });
    Object.defineProperty(screen, 'colorDepth', { get: () => selectedScreen.colorDepth });
    Object.defineProperty(screen, 'pixelDepth', { get: () => selectedScreen.colorDepth });
  });
}
