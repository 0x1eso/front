/**
 * WarfareRingPass — expanded warfare rings (spec §14b): each coastal
 * battery's reach and each airport's range (shown, like SAM rings, while a
 * warfare unit is being placed or its card is open), and every coastal
 * barrage zone (always shown). Reuses the range-circle shaders.
 */

import {
  airportRange,
  BARRAGE_RADIUS,
  COASTAL_BATTERY_RANGE,
} from "@openfront/engine-lib/warfare/Warfare";
import type { UnitState } from "../../types";
import {
  UT_AIRPORT,
  UT_COASTAL_BARRAGE,
  UT_COASTAL_BATTERY,
} from "../../types";
import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/range-circle/range-circle.frag.glsl?raw";
import vertSrc from "../shaders/range-circle/range-circle.vert.glsl?raw";

export interface Ring {
  x: number;
  y: number;
  radius: number;
  color: readonly [number, number, number];
}

const SELF = [0.3, 0.85, 0.45] as const;
const ALLY = [0.95, 0.85, 0.3] as const;
const ENEMY = [0.95, 0.35, 0.3] as const;
const ZONE = [1.0, 0.55, 0.1] as const;

/** Rings of finished coastal batteries and airports. */
export function structureRings(
  units: Map<number, UnitState>,
  mapW: number,
  localPlayerID: number,
  allies: ReadonlySet<number>,
): Ring[] {
  const rings: Ring[] = [];
  for (const u of units.values()) {
    if (!u.isActive || u.underConstruction) continue;
    let radius: number;
    if (u.unitType === UT_COASTAL_BATTERY) {
      radius = COASTAL_BATTERY_RANGE;
    } else if (u.unitType === UT_AIRPORT) {
      radius = airportRange(u.level);
    } else {
      continue;
    }
    const x = u.pos % mapW;
    rings.push({
      x,
      y: (u.pos - x) / mapW,
      radius,
      color:
        u.ownerID === localPlayerID
          ? SELF
          : allies.has(u.ownerID)
            ? ALLY
            : ENEMY,
    });
  }
  return rings;
}

/** Barrage zones: the aimed tile of every salvo in flight or holding its zone. */
export function zoneRings(units: Map<number, UnitState>, mapW: number): Ring[] {
  const rings: Ring[] = [];
  for (const u of units.values()) {
    if (!u.isActive || u.unitType !== UT_COASTAL_BARRAGE) continue;
    const x = u.pos % mapW;
    rings.push({
      x,
      y: (u.pos - x) / mapW,
      radius: BARRAGE_RADIUS,
      color: ZONE,
    });
  }
  return rings;
}

export class WarfareRingPass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;

  private uCamera: WebGLUniformLocation;
  private uCenter: WebGLUniformLocation;
  private uRadius: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;

  private visible = false;
  private localPlayerID = 0;
  private allies: ReadonlySet<number> = new Set();
  private lastStructures: Map<number, UnitState> | null = null;
  private structures: Ring[] = [];
  private zones: Ring[] = [];

  constructor(
    gl: WebGL2RenderingContext,
    private mapW: number,
  ) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc, "WarfareRingPass");
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uCenter = gl.getUniformLocation(this.program, "uCenter")!;
    this.uRadius = gl.getUniformLocation(this.program, "uRadius")!;
    this.uColor = gl.getUniformLocation(this.program, "uColor")!;

    // Unit quad [0,1]
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

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  setLocalPlayer(id: number): void {
    this.localPlayerID = id;
    this.rebuild();
  }

  setAllies(allies: ReadonlySet<number>): void {
    this.allies = allies;
    this.rebuild();
  }

  updateStructures(units: Map<number, UnitState>): void {
    this.lastStructures = units;
    this.rebuild();
  }

  updateUnits(units: Map<number, UnitState>): void {
    this.zones = zoneRings(units, this.mapW);
  }

  private rebuild(): void {
    this.structures =
      this.lastStructures === null
        ? []
        : structureRings(
            this.lastStructures,
            this.mapW,
            this.localPlayerID,
            this.allies,
          );
  }

  draw(cameraMatrix: Float32Array): void {
    const rings = this.visible
      ? [...this.structures, ...this.zones]
      : this.zones;
    if (rings.length === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.bindVertexArray(this.vao);
    for (const ring of rings) {
      gl.uniform2f(this.uCenter, ring.x, ring.y);
      gl.uniform1f(this.uRadius, ring.radius);
      gl.uniform3f(this.uColor, ring.color[0], ring.color[1], ring.color[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.quadBuf);
  }
}
