export default `

precision highp float;

// Fragment shader output
out vec4 outFragColor;

uniform sampler2D uEnvironnementTexture;

float PI = 3.14159265359;

// From three.js
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

// From three.js
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

vec3 RGBMDecode(vec4 rgbm) {
  return 6.0 * rgbm.rgb * rgbm.a;
}

vec2 cartesianToSpherical(vec3 cartesian) {
  // Compute azimuthal angle, in [-PI, PI]
  float phi = atan(cartesian.z, cartesian.x);
  // Compute polar angle, in [-PI/2, PI/2]
  float theta = asin(cartesian.y);
  return vec2(phi, theta);
}

vec2 ToUV(vec3 direction) {
  vec2 spherical = cartesianToSpherical(direction);
  vec2 remapSpherical = 0.5 * (spherical / vec2(PI, PI / 2.0) + 1.0);
  return vec2(remapSpherical.x, 1.0 - remapSpherical.y);
}

void main()
{
  vec3 acc = vec3(0.0); 
  int count = 0;
  for(float phi = 0.0; phi < 2.0 * PI; phi += 0.25)
  {
    for(float theta = 0.0; theta < 0.5 * PI; theta += 0.25)
    {
        // Direction must be updated using phi and theta.
        vec3 direction = vec3(sin(theta) * cos(phi), cos(theta), sin(theta) * sin(phi));
        acc += texture(uEnvironnementTexture, ToUV(direction)).rgb * cos(theta) * sin(theta);
        count++;
    }
  }
  acc = PI * acc / float(count);

  outFragColor = vec4(acc, 1.0);
}
`;
