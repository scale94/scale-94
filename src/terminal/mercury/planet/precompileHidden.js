// three's compile() walks traverseVisible, and a hidden object's program is otherwise built on its first drawn frame —
// a stall on the first tap of each element. Show the hidden ones for the compile call only, then restore them.
// Not three's compileAsync: its readiness poller calls currentProgram.isReady() unguarded on a timer, so a material torn
// down mid-poll (an HMR swap, a remount) threw "reading 'isReady'" where no caller can catch it (2026-10-08).
export function precompileHidden(gl, scene, camera, objects) {
  const hidden = objects.filter((o) => o && !o.visible);
  for (const o of hidden) o.visible = true;
  let materials;
  try { materials = gl.compile(scene, camera); }
  finally { for (const o of hidden) o.visible = false; }
  return waitProgramsReady(gl, materials);
}

// Resolves when every program has linked (KHR_parallel_shader_compile makes isReady non-blocking). A material whose
// record or program is gone, or whose check throws (lost context), has nothing left to wait for: dropped, never thrown on.
export function waitProgramsReady(gl, materials, intervalMs = 10) {
  if (!materials || typeof materials.forEach !== 'function' || !gl.properties) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      materials.forEach((m) => {
        let ready = true;
        try { const prog = gl.properties.get(m)?.currentProgram; ready = !prog || prog.isReady(); } catch { ready = true; }
        if (ready) materials.delete(m);
      });
      if (materials.size === 0) resolve();
      else setTimeout(check, intervalMs);
    };
    check();
  });
}
