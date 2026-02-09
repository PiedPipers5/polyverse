/**
 * Animation utility functions for POLYVERSE landing page
 */

/**
 * Easing functions for smooth animations
 */
export const easing = {
    // Ease out cubic for natural deceleration
    easeOutCubic: (t: number): number => {
        return 1 - Math.pow(1 - t, 3);
    },

    // Ease in out cubic for smooth start and end
    easeInOutCubic: (t: number): number => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },

    // Ease out expo for quick deceleration
    easeOutExpo: (t: number): number => {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }
};

/**
 * Animates a counter from start to end value
 */
export function animateCounter(
    element: HTMLElement,
    start: number,
    end: number,
    duration: number = 2000,
    easingFn: (t: number) => number = easing.easeOutExpo
): void {
    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easingFn(progress);

        const currentValue = Math.floor(start + (end - start) * easedProgress);
        element.textContent = currentValue.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = end.toLocaleString();
        }
    };

    requestAnimationFrame(updateCounter);
}

/**
 * Calculate parallax offset based on mouse position
 */
export function calculateParallax(
    mouseX: number,
    mouseY: number,
    elementX: number,
    elementY: number,
    strength: number = 0.05
): { x: number; y: number } {
    const deltaX = mouseX - elementX;
    const deltaY = mouseY - elementY;

    return {
        x: deltaX * strength,
        y: deltaY * strength
    };
}

/**
 * Calculate 3D tilt transform based on mouse position
 */
export function calculate3DTilt(
    mouseX: number,
    mouseY: number,
    rect: DOMRect,
    maxTilt: number = 15
): string {
    const x = mouseX - rect.left;
    const y = mouseY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * maxTilt;
    const rotateY = ((centerX - x) / centerX) * maxTilt;

    return `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
}

/**
 * Reset 3D tilt transform
 */
export function reset3DTilt(): string {
    return 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
}

/**
 * Stagger animation delay calculator
 */
export function getStaggerDelay(index: number, baseDelay: number = 100): number {
    return index * baseDelay;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}
