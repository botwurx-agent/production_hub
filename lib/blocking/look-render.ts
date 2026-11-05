// Shot blocking: how a frame through the shot camera is drawn. A plain
// render, then ambient occlusion (GTAO: the soft darkening where things meet,
// under a car, where a building meets the pavement, inside a tree's canopy),
// then the colour conversion to the screen. Occlusion is most of what makes a
// clay blockout read as a place rather than as boxes on a floor.
//
// One ShotRenderer per WebGL renderer: the editor's (camera view and the
// picture in picture) and the recording's, so a recorded clip and a saved
// frame look exactly like the camera view.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Look } from "./scene";

/**
 * GTAO draws the scene's normals in a pass of its own. Anything that is not
 * set must stay out of it: the editor's helpers (the camera path, the move
 * gizmo, key dots) would otherwise darken the set around them, and glass
 * would shade the cabin it should be seen through.
 */
class SetOnlyAO extends GTAOPass {
  overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverse((o) => {
      const any = o as THREE.Object3D & { isLine2?: boolean; isLineSegments2?: boolean; material?: THREE.Material };
      if (o.userData.helper || any.isLine2 || any.isLineSegments2 || o.type.startsWith("TransformControls") || any.material?.transparent) o.visible = false;
    });
  }
}

/** How strong the occlusion is in each look. Blockout keeps its colours flatter. */
const AO: Record<Look, number> = { blockout: 0.65, clay: 1, lit: 0.85 };

export class ShotRenderer {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private ao: SetOnlyAO;
  private w = 0;
  private h = 0;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, pixelRatio: number) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(pixelRatio);
    this.renderPass = new RenderPass(scene, camera);
    this.ao = new SetOnlyAO(scene, camera, 1, 1);
    // World-space radius in metres: wide enough for the shade under a car and
    // along the foot of a wall, small enough not to grey a whole street.
    this.ao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.6, thickness: 2.5, scale: 1.6, samples: 16, distanceFallOff: 1 });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.ao);
    this.composer.addPass(new OutputPass());
  }

  /**
   * Draws the shot into a rectangle of the canvas (CSS pixels, from the
   * bottom left, the way setViewport takes it), or the whole canvas when
   * no rectangle is given.
   */
  render(look: Look, rect?: { x: number; y: number; w: number; h: number }) {
    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    const box = rect ?? { x: 0, y: 0, w: size.x, h: size.y };
    const w = Math.max(1, Math.round(box.w));
    const h = Math.max(1, Math.round(box.h));
    if (w !== this.w || h !== this.h) {
      this.composer.setSize(w, h);
      this.w = w;
      this.h = h;
    }
    this.ao.blendIntensity = AO[look];
    // The last pass draws to the screen through the renderer's own viewport
    // and scissor, which is what puts the frame inside its letterbox.
    r.setViewport(box.x, box.y, box.w, box.h);
    r.setScissor(box.x, box.y, box.w, box.h);
    r.setScissorTest(!!rect);
    this.composer.render();
    r.setScissorTest(false);
  }

  dispose() {
    this.ao.dispose();
    this.composer.dispose();
  }
}
