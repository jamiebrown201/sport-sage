/**
 * Behavioral Fingerprinting Defense
 *
 * Simulates human-like behavior to avoid bot detection:
 * - B-spline/Bezier mouse movement (natural curves)
 * - Random scroll patterns
 * - Element hover without clicking
 * - Natural typing speed
 */

import type { Page } from 'playwright';
import { logger } from '../logger.js';

interface Point {
  x: number;
  y: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a cubic Bezier curve path for natural mouse movement
 */
function generateBezierPath(start: Point, end: Point, steps: number = 20): Point[] {
  const path: Point[] = [];

  // Generate two random control points for natural curve
  const control1: Point = {
    x: start.x + (end.x - start.x) * 0.25 + randomBetween(-50, 50),
    y: start.y + (end.y - start.y) * 0.25 + randomBetween(-30, 30),
  };

  const control2: Point = {
    x: start.x + (end.x - start.x) * 0.75 + randomBetween(-50, 50),
    y: start.y + (end.y - start.y) * 0.75 + randomBetween(-30, 30),
  };

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    // Cubic Bezier formula
    const x =
      Math.pow(1 - t, 3) * start.x +
      3 * Math.pow(1 - t, 2) * t * control1.x +
      3 * (1 - t) * Math.pow(t, 2) * control2.x +
      Math.pow(t, 3) * end.x;

    const y =
      Math.pow(1 - t, 3) * start.y +
      3 * Math.pow(1 - t, 2) * t * control1.y +
      3 * (1 - t) * Math.pow(t, 2) * control2.y +
      Math.pow(t, 3) * end.y;

    path.push({ x: Math.round(x), y: Math.round(y) });
  }

  return path;
}

/**
 * Move mouse along a natural Bezier curve path
 */
async function moveMouseNaturally(page: Page, from: Point, to: Point): Promise<void> {
  const path = generateBezierPath(from, to, randomBetween(15, 25));

  for (const point of path) {
    await page.mouse.move(point.x, point.y);
    // Variable speed - faster in the middle, slower at start/end
    await sleep(randomBetween(5, 20));
  }
}

/**
 * Simulate human-like scrolling behavior
 */
async function simulateScrolling(page: Page): Promise<void> {
  const scrollCount = randomBetween(1, 3);

  for (let i = 0; i < scrollCount; i++) {
    const scrollAmount = randomBetween(100, 400);
    const direction = Math.random() > 0.3 ? 1 : -1; // 70% scroll down

    await page.evaluate(
      ({ amount, dir }) => {
        window.scrollBy({
          top: amount * dir,
          behavior: 'smooth',
        });
      },
      { amount: scrollAmount, dir: direction }
    );

    await sleep(randomBetween(500, 1500));
  }
}

/**
 * Hover over random elements without clicking
 */
async function simulateElementHovers(page: Page): Promise<void> {
  try {
    // Get some hoverable elements
    const elements = await page.$$('a, button, [role="button"]');

    if (elements.length === 0) return;

    // Hover over 1-2 random elements
    const hoverCount = Math.min(randomBetween(1, 2), elements.length);
    const selectedIndices = new Set<number>();

    while (selectedIndices.size < hoverCount) {
      selectedIndices.add(randomBetween(0, elements.length - 1));
    }

    for (const index of selectedIndices) {
      try {
        const element = elements[index];
        const box = await element.boundingBox();

        if (box && box.width > 0 && box.height > 0) {
          // Get current mouse position (or start from center)
          const viewport = page.viewportSize() || { width: 1920, height: 1080 };
          const currentPos = { x: viewport.width / 2, y: viewport.height / 2 };

          const targetPos = {
            x: box.x + box.width / 2 + randomBetween(-10, 10),
            y: box.y + box.height / 2 + randomBetween(-10, 10),
          };

          await moveMouseNaturally(page, currentPos, targetPos);
          await sleep(randomBetween(300, 800));
        }
      } catch {
        // Element might have been removed, continue
      }
    }
  } catch (error) {
    logger.debug('Element hover simulation failed', { error });
  }
}

/**
 * Simulate random mouse movement (idle behavior)
 */
async function simulateIdleMovement(page: Page): Promise<void> {
  const viewport = page.viewportSize() || { width: 1920, height: 1080 };

  // Random starting position
  const start: Point = {
    x: randomBetween(100, viewport.width - 100),
    y: randomBetween(100, viewport.height - 100),
  };

  // Random ending position (not too far)
  const end: Point = {
    x: start.x + randomBetween(-200, 200),
    y: start.y + randomBetween(-100, 100),
  };

  // Clamp to viewport
  end.x = Math.max(50, Math.min(viewport.width - 50, end.x));
  end.y = Math.max(50, Math.min(viewport.height - 50, end.y));

  await moveMouseNaturally(page, start, end);
}

/**
 * Main function to simulate human behavior
 * Call this before critical scraping actions
 */
export async function simulateHumanBehavior(page: Page): Promise<void> {
  const actions: Array<() => Promise<void>> = [
    () => simulateIdleMovement(page),
    () => simulateScrolling(page),
    () => simulateElementHovers(page),
  ];

  // Randomly select 1-2 actions
  const actionCount = randomBetween(1, 2);
  const shuffled = actions.sort(() => Math.random() - 0.5);

  for (let i = 0; i < actionCount; i++) {
    await shuffled[i]();
    await sleep(randomBetween(200, 500));
  }
}

/**
 * Type text with human-like variable speed
 */
export async function typeHumanLike(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await sleep(randomBetween(100, 300));

  for (const char of text) {
    await page.keyboard.type(char, { delay: randomBetween(50, 150) });
  }
}

/**
 * Wait with random jitter (to avoid exact timing patterns)
 */
export async function waitWithJitter(baseMs: number, jitterPercent: number = 20): Promise<void> {
  const jitter = baseMs * (jitterPercent / 100);
  const actual = baseMs + randomBetween(-jitter, jitter);
  await sleep(Math.max(100, actual));
}
