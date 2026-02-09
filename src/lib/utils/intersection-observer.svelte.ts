/**
 * Svelte 5 rune-based Intersection Observer utility
 * For triggering animations when elements enter viewport
 */

interface IntersectionObserverOptions {
    threshold?: number;
    rootMargin?: string;
    triggerOnce?: boolean;
}

/**
 * Create an intersection observer with reactive state
 */
export function createIntersectionObserver(
    options: IntersectionObserverOptions = {}
) {
    const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;

    let isVisible = $state(false);
    let observer: IntersectionObserver | null = null;

    return {
        get isVisible() {
            return isVisible;
        },

        observe(element: HTMLElement) {
            if (observer) {
                observer.disconnect();
            }

            observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            isVisible = true;
                            if (triggerOnce && observer) {
                                observer.disconnect();
                            }
                        } else if (!triggerOnce) {
                            isVisible = false;
                        }
                    });
                },
                { threshold, rootMargin }
            );

            observer.observe(element);

            return () => {
                if (observer) {
                    observer.disconnect();
                }
            };
        }
    };
}
