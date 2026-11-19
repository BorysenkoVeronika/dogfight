export function createCanvas(canvas:HTMLCanvasElement) {
    const context = canvas.getContext('2d');

    if (!context) throw new Error('2D canvas context unavailable');
    const ctx:CanvasRenderingContext2D = context;
    function resize():void {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener('resize', resize);
    resize();

    return {
        ctx,
        resize,
    };
}