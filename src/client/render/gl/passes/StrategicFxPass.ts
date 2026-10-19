/**
 * StrategicFxPass — strategic weapons (spec §6.6): the stronger effects, all
 * thin and drawn on the map, never over the whole screen.
 *
 *  - preparing silo: satellite badge above it, slowly pulsing cyan ring, time
 *    left label (all with a minimum on-screen size so they read zoomed out)
 *  - launch / interception: a thin streak rising from the silo and fading
 *  - strike countdown: the target's border pulses (BorderStampPass reads
 *    `pulseOwners`/`pulseValues`)
 *  - world congress emergency: the target's border pulses slowly (0.5 Hz)
 *  - strike impacts: an expanding blue ripple ring
 *
 * Nothing is drawn, and nothing allocates, while there is nothing to show.
 */

import {
  borderPulse,
  formatClock,
  STRIKE_TOTAL_TICKS,
} from "../../frame/derive/StrategicFx";
import { renderDpr } from "../utils/Dpr";
import { createProgram } from "../utils/GlUtils";
import type { AttackTroopLabel } from "./WorldTextPass";

import shapeFrag from "../shaders/strategic-fx/shape.frag.glsl?raw";
import shapeVert from "../shaders/strategic-fx/shape.vert.glsl?raw";
import streakFrag from "../shaders/strategic-fx/streak.frag.glsl?raw";
import streakVert from "../shaders/strategic-fx/streak.vert.glsl?raw";

export const MAX_PULSES = 4;

/** World congress: an emergency target's border pulses this slowly (spec §12). */
export const CONGRESS_PULSE_HZ = 0.5;

/** Border pulse 0..1 at `ms` on the frame clock, starting dark. */
export function congressPulse(ms: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * CONGRESS_PULSE_HZ * ms) / 1000);
}
const LAUNCH_MS = 1400;
const INTERCEPT_MS = 1000;
const RIPPLE_MS = 1800;
const MAX_EFFECTS = 64;
const CYAN = [0.2, 0.85, 1.0] as const;
const LAUNCH_COLOR = [0.8, 0.95, 1.0] as const;
const INTERCEPT_COLOR = [1.0, 0.75, 0.3] as const;
const RIPPLE_COLOR = [0.35, 0.65, 1.0] as const;

export interface PreparingFx {
  x: number;
  y: number;
  secondsLeft: number;
}

export interface CountdownFx {
  ownerID: number;
  x: number;
  y: number;
  maxRadius: number;
  leftTicks: number;
}

interface Timed {
  x: number;
  y: number;
  start: number;
}

export class StrategicFxPass {
  private gl: WebGL2RenderingContext;
  private shape: WebGLProgram;
  private streak: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;

  private sCamera: WebGLUniformLocation;
  private sCenter: WebGLUniformLocation;
  private sHalf: WebGLUniformLocation;
  private sMode: WebGLUniformLocation;
  private sInner: WebGLUniformLocation;
  private sOuter: WebGLUniformLocation;
  private sColor: WebGLUniformLocation;
  private sAlpha: WebGLUniformLocation;
  private tCamera: WebGLUniformLocation;
  private tBase: WebGLUniformLocation;
  private tLength: WebGLUniformLocation;
  private tWidth: WebGLUniformLocation;
  private tAge: WebGLUniformLocation;
  private tColor: WebGLUniformLocation;

  private timeFn: () => number = () => performance.now();
  private preparing: readonly PreparingFx[] = [];
  private countdowns: readonly CountdownFx[] = [];
  private countdownStamp = 0;
  private congressTargets: readonly number[] = [];
  private launches: Timed[] = [];
  private intercepts: Timed[] = [];
  private ripples: Timed[] = [];

  /** Territory owners whose border pulses, and how bright (read by BorderStampPass). */
  readonly pulseOwners = new Uint32Array(MAX_PULSES);
  readonly pulseValues = new Float32Array(MAX_PULSES);
  pulseCount = 0;

  /** Time-left labels under the preparing silos; handed to WorldTextPass. */
  readonly labels: AttackTroopLabel[] = [];
  private labelPool: AttackTroopLabel[] = [];
  private labelSeconds: number[] = [];

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.shape = createProgram(gl, shapeVert, shapeFrag, "StrategicFxShape");
    this.streak = createProgram(
      gl,
      streakVert,
      streakFrag,
      "StrategicFxStreak",
    );
    const u = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n)!;
    this.sCamera = u(this.shape, "uCamera");
    this.sCenter = u(this.shape, "uCenter");
    this.sHalf = u(this.shape, "uHalf");
    this.sMode = u(this.shape, "uMode");
    this.sInner = u(this.shape, "uInner");
    this.sOuter = u(this.shape, "uOuter");
    this.sColor = u(this.shape, "uColor");
    this.sAlpha = u(this.shape, "uAlpha");
    this.tCamera = u(this.streak, "uCamera");
    this.tBase = u(this.streak, "uBase");
    this.tLength = u(this.streak, "uLength");
    this.tWidth = u(this.streak, "uWidth");
    this.tAge = u(this.streak, "uAge");
    this.tColor = u(this.streak, "uColor");

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  setTimeFn(fn: () => number): void {
    this.timeFn = fn;
  }

  /** Silos preparing a satellite (set once per tick). */
  setPreparing(items: readonly PreparingFx[]): void {
    this.preparing = items;
  }

  /** Strikes counting down (set once per tick; interpolated between ticks). */
  setCountdowns(items: readonly CountdownFx[]): void {
    this.countdowns = items;
    this.countdownStamp = this.timeFn();
  }

  private push(list: Timed[], points: readonly { x: number; y: number }[]) {
    const start = this.timeFn();
    for (const p of points) {
      if (list.length >= MAX_EFFECTS) list.shift();
      list.push({ x: p.x, y: p.y, start });
    }
  }

  /** World congress: emergency targets whose borders pulse (set when they change). */
  setCongressTargets(ownerIDs: readonly number[]): void {
    this.congressTargets = ownerIDs;
  }

  spawnLaunch(points: readonly { x: number; y: number }[]): void {
    this.push(this.launches, points);
  }

  spawnIntercept(points: readonly { x: number; y: number }[]): void {
    this.push(this.intercepts, points);
  }

  spawnRipples(points: readonly { x: number; y: number }[]): void {
    this.push(this.ripples, points);
  }

  /** Whether anything needs drawing or pulsing this frame. */
  isIdle(): boolean {
    return (
      this.preparing.length === 0 &&
      this.countdowns.length === 0 &&
      this.launches.length === 0 &&
      this.intercepts.length === 0 &&
      this.ripples.length === 0 &&
      this.congressTargets.length === 0
    );
  }

  private leftNow(c: CountdownFx, now: number): number {
    return Math.max(0, c.leftTicks - (now - this.countdownStamp) / 100);
  }

  /** Border pulse values for this frame (call before BorderStampPass draws). */
  updatePulses(): void {
    let n = 0;
    if (this.countdowns.length > 0) {
      const now = this.timeFn();
      for (const c of this.countdowns) {
        if (n >= MAX_PULSES) break;
        this.pulseOwners[n] = c.ownerID;
        this.pulseValues[n] = borderPulse(
          this.leftNow(c, now),
          STRIKE_TOTAL_TICKS,
        );
        n++;
      }
    }
    if (this.congressTargets.length > 0) {
      const value = congressPulse(this.timeFn());
      for (const id of this.congressTargets) {
        if (n >= MAX_PULSES) break;
        // A strike countdown on the same nation already pulses its border.
        if (this.pulsesOwner(id, n)) continue;
        this.pulseOwners[n] = id;
        this.pulseValues[n] = value;
        n++;
      }
    }
    this.pulseCount = n;
  }

  private pulsesOwner(ownerID: number, count: number): boolean {
    for (let i = 0; i < count; i++) {
      if (this.pulseOwners[i] === ownerID) return true;
    }
    return false;
  }

  /** Keep the time-left labels under the silos at a constant on-screen offset (call before WorldTextPass.tick). */
  updateLabels(zoom: number): void {
    const items = this.preparing;
    const offset = (30 * renderDpr()) / Math.max(zoom, 0.0001);
    for (let i = 0; i < items.length; i++) {
      if (this.labelPool.length <= i) {
        this.labelPool.push({
          x: 0,
          y: 0,
          text: "",
          colorR: CYAN[0],
          colorG: CYAN[1],
          colorB: CYAN[2],
        });
        this.labelSeconds.push(-1);
      }
      const label = this.labelPool[i];
      if (this.labelSeconds[i] !== items[i].secondsLeft) {
        this.labelSeconds[i] = items[i].secondsLeft;
        label.text = formatClock(items[i].secondsLeft);
      }
      label.x = items[i].x;
      label.y = items[i].y + offset;
      this.labels[i] = label;
    }
    this.labels.length = items.length;
  }

  draw(cameraMatrix: Float32Array, zoom: number): void {
    if (this.isIdle()) return;
    const now = this.timeFn();
    this.launches = this.launches.filter((e) => now - e.start < LAUNCH_MS);
    this.intercepts = this.intercepts.filter(
      (e) => now - e.start < INTERCEPT_MS,
    );
    this.ripples = this.ripples.filter((e) => now - e.start < RIPPLE_MS);
    const gl = this.gl;
    const dpr = renderDpr();
    const pxToTiles = dpr / Math.max(zoom, 0.0001);

    gl.bindVertexArray(this.vao);

    if (this.launches.length > 0 || this.intercepts.length > 0) {
      gl.useProgram(this.streak);
      gl.uniformMatrix3fv(this.tCamera, false, cameraMatrix);
      gl.uniform1f(this.tWidth, Math.max(0.5, 3 * pxToTiles));
      this.drawStreaks(
        this.launches,
        LAUNCH_MS,
        420 * pxToTiles,
        LAUNCH_COLOR,
        now,
      );
      this.drawStreaks(
        this.intercepts,
        INTERCEPT_MS,
        900 * pxToTiles,
        INTERCEPT_COLOR,
        now,
      );
    }

    gl.useProgram(this.shape);
    gl.uniformMatrix3fv(this.sCamera, false, cameraMatrix);

    for (const e of this.ripples) {
      const t = (now - e.start) / RIPPLE_MS;
      this.drawRing(
        e.x,
        e.y,
        2 + 16 * t,
        2 * pxToTiles,
        RIPPLE_COLOR,
        0.8 * (1 - t),
      );
    }

    // Preparing silos: ring (pulsing, never smaller than 26 px) and badge.
    const beat = 0.5 - 0.5 * Math.cos((now / 2400) * 2 * Math.PI);
    for (const p of this.preparing) {
      const base = Math.max(5, 26 * pxToTiles);
      this.drawRing(
        p.x,
        p.y,
        base * (1 + 0.1 * beat),
        2.5 * pxToTiles,
        CYAN,
        0.45 + 0.5 * beat,
      );
      const half = Math.max(2.2, 13 * pxToTiles);
      this.drawBadge(p.x, p.y - base - half * 0.4, half);
    }

    gl.bindVertexArray(null);
  }

  private drawStreaks(
    list: readonly Timed[],
    ms: number,
    length: number,
    color: readonly [number, number, number],
    now: number,
  ): void {
    if (list.length === 0) return;
    const gl = this.gl;
    gl.uniform1f(this.tLength, length);
    gl.uniform3f(this.tColor, color[0], color[1], color[2]);
    for (const e of list) {
      gl.uniform2f(this.tBase, e.x, e.y);
      gl.uniform1f(this.tAge, (now - e.start) / ms);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  private drawRing(
    x: number,
    y: number,
    radius: number,
    thickness: number,
    color: readonly [number, number, number],
    alpha: number,
  ): void {
    const gl = this.gl;
    const half = radius + thickness;
    gl.uniform1f(this.sMode, 0);
    gl.uniform2f(this.sCenter, x, y);
    gl.uniform1f(this.sHalf, half);
    gl.uniform1f(this.sInner, Math.max(0, (radius - thickness) / half));
    gl.uniform1f(this.sOuter, radius / half);
    gl.uniform3f(this.sColor, color[0], color[1], color[2]);
    gl.uniform1f(this.sAlpha, alpha);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private drawBadge(x: number, y: number, half: number): void {
    const gl = this.gl;
    gl.uniform1f(this.sMode, 1);
    gl.uniform2f(this.sCenter, x, y);
    gl.uniform1f(this.sHalf, half);
    gl.uniform3f(this.sColor, CYAN[0], CYAN[1], CYAN[2]);
    gl.uniform1f(this.sAlpha, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.shape);
    gl.deleteProgram(this.streak);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.quadBuf);
  }
}
