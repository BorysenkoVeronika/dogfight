export class Vector2 {
    x: number;
    y: number;
    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    /** Mutation for measured simulation hot paths; pure methods remain unchanged. */
    addScaledInPlace(x: number, y: number, scalar: number): this {
        this.x += x * scalar;
        this.y += y * scalar;
        return this;
    }
    scaleInPlace(scalar: number): this {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }
    setInPlace(x: number, y: number): this {
        this.x = x;
        this.y = y;
        return this;
    }

    add(v: Vector2): Vector2 {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    sub(v: Vector2): Vector2 {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    scale(s: number): Vector2 {
        return new Vector2(this.x * s, this.y * s);
    }

    length(): number {
        return Math.hypot(this.x, this.y);
    }

    normalize(): Vector2 {
        const len = this.length();
        if (len === 0) return new Vector2();
        return this.scale(1 / len);
    }

    rotate(angle: number): Vector2 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        return new Vector2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    dot(v: Vector2): number {
        return this.x * v.x + this.y * v.y;
    }

    static fromAngle(angle: number): Vector2 {
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }
}