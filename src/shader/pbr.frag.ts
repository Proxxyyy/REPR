export default `

precision highp float;

// Varyings
in vec3 vNormalWS;
in vec3 vPositionWS;

// Fragment shader output
out vec4 outFragColor;

// Uniforms
struct Camera
{
  mat4 WS_to_CS; // World-Space to Clip-Space (view * proj)
  vec3 positionWS; // Camera position in World-Space
};
uniform Camera uCamera;

struct Material
{
  vec3 albedo;
};
uniform Material uMaterial;

struct PointLight
{
  vec3 positionWS;
  vec3 color;
  float intensity;
};
uniform PointLight uPointLights[POINT_LIGHT_COUNT];

// From three.js
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

// From three.js
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

void main()
{
  // **DO NOT** forget to do all your computation in linear space.
  vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;

  // Basic lambert diffuse with inverse-square attenuation from point lights.
  vec3 N = normalize(vNormalWS);

  vec3 irradiance = vec3(0.0);
  for (int i = 0; i < POINT_LIGHT_COUNT; ++i) {
    vec3 L = uPointLights[i].positionWS - vPositionWS;
    float NdotL = clamp(dot(N, L), 0.0, 1.0);
    //float attenuation = 1.0 / (dist * dist);
    //vec3 radiance = uPointLights[i].color * uPointLights[i].intensity;// * attenuation;

    vec3 radiance = (uPointLights[i].intensity / (4.0 * 3.14 * length(L))) * NdotL * vec3(1.0);
    vec3 radianceACES = clamp((radiance * (2.51 * radiance + 0.03)) / (radiance * (2.43 * radiance + 0.59) + 0.14), vec3(0.0), vec3(1.0));

    irradiance += radianceACES;
  }

  /*  vec3 irradiance = vec3(0.0);
  for (int i = 0; i < POINT_LIGHT_COUNT; ++i) {
    vec3 Lvec = uPointLights[i].positionWS - vPositionWS;
    float dist = length(Lvec);
    if (dist > 0.0) {
      vec3 L = Lvec / dist;
      float NdotL = max(dot(N, L), 0.0);
      float attenuation = 1.0 / (dist * dist);
      vec3 radiance = uPointLights[i].color * uPointLights[i].intensity * attenuation;
      irradiance += radiance * NdotL;
    }
  }*/


  vec3 color = albedo * irradiance;

  // NormalWS
  // vec3 NormalWS = (vNormalWS + 1.0) / 2.0;
  // outFragColor = LinearTosRGB(vec4(NormalWS, 1.0));

  // ViewDirectionWS
  // vec3 ViewDirectionWS = normalize(uCamera.positionWS - vPositionWS);
  // outFragColor = LinearTosRGB(vec4(ViewDirectionWS, 1.0));

  outFragColor = LinearTosRGB(vec4(color, 1.0));
}
`;
