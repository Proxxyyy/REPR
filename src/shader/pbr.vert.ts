export default `

precision highp float;

// Attributes (vertex shader inputs)
in vec3 in_position;
in vec3 in_normal;
#ifdef USE_UV
  in vec2 in_uv;
#endif

// Varyings (vertex shader outputs)
out vec3 vNormalWS;
out vec3 vPositionWS;
#ifdef USE_UV
  out vec2 vUv;
#endif

// Uniforms
struct Camera
{
  mat4 WS_to_CS; // World-Space to Clip-Space (view * proj)
  vec3 positionWS; // Camera position in World-Space
};
uniform Camera uCamera;

struct Model
{
  mat4 LS_to_WS; // Local-Space to World-Space
};
uniform Model uModel;

void main()
{
  vec4 vPositionLS = vec4(in_position, 1.0);
  vPositionWS = (uModel.LS_to_WS * vPositionLS).xyz;

  vNormalWS = (uModel.LS_to_WS * vec4(in_normal, 0.0)).xyz;

  gl_Position = uCamera.WS_to_CS * uModel.LS_to_WS * vPositionLS;
}
`;
