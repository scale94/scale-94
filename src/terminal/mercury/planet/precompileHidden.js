// three's compile() walks traverseVisible, and a hidden object's program is otherwise built on its first drawn frame —
// a stall on the first tap of each element. Show the hidden ones for the compile call only, then restore them.
export function precompileHidden(gl, scene, camera, objects) {
  const hidden = objects.filter((o) => o && !o.visible);
  for (const o of hidden) o.visible = true;
  let p;
  try { p = gl.compileAsync ? gl.compileAsync(scene, camera) : (gl.compile(scene, camera), Promise.resolve()); }
  finally { for (const o of hidden) o.visible = false; }
  return p;
}
