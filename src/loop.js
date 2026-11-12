export function createLoop({
    step = 1 / 60,
    simulate,
    render,
}) {

    let running = false;
    let animationId = null;

    let previousTime = 0;
    let accumulator = 0;

    let simulationSteps = 0;
    let renderFrames = 0;
    let lastFrameDuration = 0;

    let statsElapsed = 0;

    let stepsPerSecond = 0;
    let framesPerSecond = 0;

    function frame(now) {
        if (!running) return;

        const frameTime = (now - previousTime) / 1000;
        previousTime = now;

        accumulator += Math.min(frameTime, 0.25);

        while (accumulator >= step) {
            simulate(step);
            accumulator -= step;
            simulationSteps++;
        }

        const alpha = accumulator / step;
        
        renderFrames++;
        lastFrameDuration = frameTime * 1000;

        statsElapsed += frameTime;
        if (statsElapsed >= 1) {
            stepsPerSecond = simulationSteps / statsElapsed;
            framesPerSecond = renderFrames / statsElapsed;

            simulationSteps = 0;
            renderFrames = 0;
            statsElapsed = 0;
        }

        render(alpha, {
            stepsPerSecond,
            framesPerSecond,
            lastFrameDuration,
        });
        animationId = requestAnimationFrame(frame);
    }

    function start() {
        if (running) return;

        running = true;
        previousTime = performance.now();
        accumulator = 0;

        animationId = requestAnimationFrame(frame);

    }

    function stop() {
        if (!running) return;

        running = false;
        cancelAnimationFrame(animationId);
        animationId = null;

    }

    return {
        start,
        stop,
    };

}