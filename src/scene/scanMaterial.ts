// Materialien des Scans: Transparenz und Ausblenden der gescannten Räder.
// Ein Rad wird als „Stadion“ in der x-z-Ebene ausgeschnitten (Kreis, über den möglichen
// Radhub verlängert), nur im äußeren Bereich |y| > innerY – so bleiben Karosserie und
// Radlauf stehen, Reifen und Felge verschwinden, die berechneten Räder werden sichtbar.

import * as THREE from "three";

export interface WheelCut {
  x: number;
  z: number; // Radmitte Serienlage
  r: number; // Ausschnittradius
  innerY: number;
}

export interface ScanMatOptions {
  opacity: number;
  cuts: WheelCut[] | null;
  /** Karosserie → Welt; wird je Bild aktualisiert. */
  bodyInverse: { value: THREE.Matrix4 };
}

const TRAVEL = 160; // mm, Radhub nach oben/unten, den der Ausschnitt abdeckt

export function applyScanMaterials(root: THREE.Object3D, o: ScanMatOptions) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];
    const mats = src.map((m0) => {
      const orig = (m0.userData.orig as THREE.Material | undefined) ?? m0;
      const m = orig.clone();
      m.userData.orig = orig;
      m.transparent = o.opacity < 1;
      m.opacity = o.opacity;
      m.depthWrite = o.opacity >= 1;
      m.side = THREE.DoubleSide;
      if (o.cuts) {
        const cuts = o.cuts;
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uBodyInv = o.bodyInverse;
          shader.uniforms.uCut = { value: cuts.map((c) => new THREE.Vector4(c.x, c.z, c.r, c.innerY)) };
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nuniform mat4 uBodyInv;\nvarying vec3 vBodyPos;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBodyPos = (uBodyInv * modelMatrix * vec4(transformed, 1.0)).xyz;");
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\nvarying vec3 vBodyPos;\nuniform vec4 uCut[${cuts.length}];`)
            .replace(
              "#include <clipping_planes_fragment>",
              `#include <clipping_planes_fragment>
              for (int i = 0; i < ${cuts.length}; i++) {
                vec4 c = uCut[i];
                if (abs(vBodyPos.y) > c.w) {
                  float dz = clamp(vBodyPos.z - c.y, -${TRAVEL}.0, ${TRAVEL}.0);
                  vec2 d = vec2(vBodyPos.x - c.x, vBodyPos.z - (c.y + dz));
                  if (dot(d, d) < c.z * c.z) discard;
                }
              }`,
            );
        };
        m.customProgramCacheKey = () => `scan-cut-${cuts.length}`;
      }
      m.needsUpdate = true;
      return m;
    });
    mesh.material = Array.isArray(mesh.material) ? mats : mats[0]!;
  });
}
