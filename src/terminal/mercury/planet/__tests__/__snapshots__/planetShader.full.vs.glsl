in vec3 position;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform float uCoreR;

out vec3 vWorld;

const float R_SCENE = 0.750000000;
const float SHAPE_MAX = 0.0600000000;

void main() {
  // Billboard at the centre plane, sized to the perspective silhouette + margin.
  float d = length(cameraPosition);
  float rb = uCoreR * (1.0 + SHAPE_MAX); // room for the moving bead (uCoreR: the live core, phase 6)
  float ext = rb * d / sqrt(max(d * d - rb * rb, 1e-4)) * 1.08;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vWorld = (right * position.x + up * position.y) * ext;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
